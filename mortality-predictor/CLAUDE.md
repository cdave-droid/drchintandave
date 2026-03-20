# MortPred — Claude Context & Development Log

This file captures all architectural decisions, design rationale, and implementation details for the MortPred clinical mortality prediction tool. It exists so future Claude sessions have full context without needing to re-explore the codebase.

---

## Project Overview

**MortPred** is a bedside clinical decision support tool for evidence-based mortality and outcome prediction. It is **not** FDA-cleared and should not be used as a sole diagnostic instrument.

- **Frontend**: Next.js 16 (Turbopack), Tailwind CSS v4, Recharts — runs on `localhost:3001`
- **Backend**: Python FastAPI — runs on `localhost:8000`
- **No database** — stateless, per-request predictions

### Running locally
```bash
# Backend (from /backend)
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Frontend (from /frontend)
npm run dev
```

Node.js ≥ 20.9.0 required (upgraded from 20.3.1 → 25.8.1 via Homebrew during session).

---

## Architecture

```
mortality-predictor/
├── frontend/src/
│   ├── app/page.tsx                   Main page — form + results
│   ├── components/forms/patient-form.tsx
│   ├── components/results/results-dashboard.tsx
│   ├── components/results/organ-chart.tsx
│   ├── lib/api.ts                     fetch wrapper → /api/predict
│   └── types/patient.ts               TypeScript mirrors of Pydantic models
│
└── backend/app/
    ├── main.py                        FastAPI app, CORS config
    ├── models/patient.py              Pydantic models (all data shapes)
    ├── routers/predict.py             POST /api/predict
    ├── scoring/calculators.py         SOFA, APACHE II, MELD, CHA₂DS₂-VASc, CURB-65
    ├── organ_models/compartment.py    ODE-based renal / cardiac / hepatic trajectories
    ├── agents/research.py             LLM research agent (Anthropic / OpenAI / fallback)
    └── services/
        ├── prediction.py              Main orchestration pipeline
        └── baseline.py                Diagnosis-stratified mortality baselines
```

### API proxy
`next.config.ts` rewrites `/api/*` → `http://localhost:8000/api/*`, so the frontend never calls the backend directly by URL.

---

## Prediction Pipeline (`services/prediction.py`)

Order of execution in `predict()`:

1. **Compute clinical scores** — SOFA, APACHE II, MELD, CHA₂DS₂-VASc, CURB-65 (where applicable)
2. **Run AI research agent** — returns `list[RiskFactor]` + narrative string
3. **Derive composite mortality estimate** — average of all `score.mortality_estimate` values; used to calibrate organ model ODEs
4. **Run organ models** — renal, cardiac, hepatic (if relevant labs/vitals present), each receives `mortality_estimate`
5. **Get diagnosis-specific baseline** — from `baseline.py` (literature → LLM → admission-type fallback)
6. **Compute outcome predictions** — log-linear model blending risk factors + clinical scores against the diagnosis baseline
7. **Build response** — `PredictionResponse` with all fields including `baseline_info`

---

## Key Models (`models/patient.py`)

### `RiskFactor`
```python
factor_name: str
description: str
relative_risk: float          # RR multiplier (1.0 = no change)
confidence: str               # "high" | "moderate" | "low"
source: str
source_url: Optional[str]
calculator_name: Optional[str]
evidence_timeframe: Optional[str]   # e.g. "30-day", "In-hospital", "Long-term"
primary_finding: Optional[str]      # verbatim stat from the paper, e.g. "HR 1.46 (95% CI 1.39–1.54)"
```

### `OutcomePrediction`
```python
outcome_type: OutcomeType
probability_low / mid / high: float
baseline_probability: float
risk_factors: list[RiskFactor]
clinical_scores: dict[str, float]
is_extrapolated: bool               # True for 90d and 1yr outcomes
extrapolation_note: Optional[str]   # explains how extrapolation was done
```

### `BaselineInfo`
```python
matched_diagnosis: str
match_method: str       # "literature" | "llm" | "fallback"
source: str
primary_finding: str    # verbatim from landmark study
n_patients: Optional[int]
population_note: Optional[str]
```

### `PredictionResponse`
```python
patient_summary: str
outcomes: list[OutcomePrediction]
organ_models: list[OrganModelOutput]
evidence_narrative: str
disclaimers: list[str]
clinical_scores_used: dict[str, float]
baseline_info: Optional[BaselineInfo]
```

---

## Organ Models (`organ_models/compartment.py`)

Three simplified ODE compartment models — renal (creatinine), cardiac (MAP), hepatic (bilirubin).

### Key design decision: mortality-calibrated ODEs
All three models accept `mortality_estimate: float` (0–1), derived from the composite clinical score average. This grounds the ODE trajectories in population-level outcomes:

- **`recovery_rate`** is multiplied by `(1 - mortality_estimate)` — high-mortality patients have near-zero recovery
- **`impaired_clearance`** is further reduced by `(1 - mortality_estimate * 0.5)`
- **Cardiac drag** is amplified by `(1 + mortality_estimate)`

**Before this change**: a SOFA-17 patient and a SOFA-2 patient with the same creatinine had identical renal trajectories.
**After**: high-mortality patients trend toward deterioration; low-mortality patients recover toward baseline.

### Organ models only run when relevant data is present
- Renal: only if `labs.creatinine` is provided
- Cardiac: only if `vitals.mean_arterial_pressure` or `vitals.heart_rate` is provided
- Hepatic: only if `labs.bilirubin_total` is provided

---

## Baseline Mortality Service (`services/baseline.py`)

Replaces the original hardcoded admission-type averages with a three-tier lookup:

### Tier 1: Literature match (40+ diagnoses)
Keyword matching against `_LITERATURE` — a list of `_Entry` objects, each with:
- Keywords to match against `primary_diagnosis` (case-insensitive)
- Setting filter (`["icu"]`, `["floor", "ed"]`, or `["any"]`)
- Independent 30d / 90d / 1yr mortality values from the specific study
- `severity_keywords` for two-pass matching (e.g. "septic shock" before "sepsis")
- Source, primary finding (verbatim), and N

**Matching is two-pass**: first tries entries that also match severity keywords (e.g. "shock"), then falls back to general entries.

### Tier 2: LLM agent lookup
If no literature match, and an API key is configured (`ANTHROPIC_API_KEY` or `LLM_API_KEY`), calls the LLM with a strict prompt requiring a specific cited study and verbatim finding. Returns `match_method="llm"`.

### Tier 3: Admission-type fallback
Original behaviour — broad averages by admission type. Returns `match_method="fallback"`.

### Key literature entries and their sources

| Diagnosis | 30d | 90d | 1yr | Source |
|---|---|---|---|---|
| Septic shock | 42.3% | 52% | 60% | Shankar-Hari, JAMA 2016, N=6,925 |
| Sepsis (general) | 22% | 32% | 42% | Seymour / Rhee, JAMA 2016–17 |
| CAP (ICU) | 28% | 38% | 48% | España, AJRCCM 2006, N=1,057 |
| CAP (floor) | 8% | 14% | 22% | Fine, NEJM 1997, N=14,199 (PORT) |
| HAP/VAP | 35% | 45% | 55% | Melsen, Lancet Infect Dis 2013 |
| ARDS (mod-severe) | 40% | 48% | 56% | LUNG SAFE, JAMA 2016, N=3,022 |
| ADHF | 10% | 20% | 30% | ADHERE (Fonarow, JAMA 2005, N=65,275) |
| STEMI | 7.1% | 9% | 10.8% | SWEDEHEART, Eur Heart J 2015, N=97,254 |
| NSTEMI | 3.8% | 7% | 11% | GRACE, N=102,341 |
| Ischaemic stroke | 12% | 16% | 23% | Feigin, Lancet 2014; GWTG-Stroke, N>500k |
| ICH | 40.4% | 48% | 54.7% | van Asch, Lancet Neurol 2010, N=8,145 |
| ACLF | 33% | 51% | 65% | CANONIC, Gastroenterology 2013, N=1,343 |
| Cirrhosis decompensation | 10% | 20% | 35% | CANONIC + D'Amico, J Hepatol 2006 |
| Acute liver failure | 35% | 42% | 50% | ALFSG (Ostapowicz, Ann Intern Med 2002) |
| DKA | 0.4% | 1% | 3% | Benoit, MMWR 2018, N=2.6M |
| PE (all comers) | 11.4% | 17.4% | 22% | ICOPER, Lancet 1999, N=2,454 |
| Massive/high-risk PE | 30% | 52.4% | 58% | ICOPER, Lancet 1999 |
| UGIB | 10% | 15% | 25% | Hearnshaw, Gut 2011, N=6,750 |
| Acute pancreatitis | 2% | 4% | 7% | Forsmark, NEJM 2016 |
| Severe pancreatitis | 22% | 32% | 40% | Petrov, Gastroenterology 2010, N=6,970 |
| AKI (ICU, any stage) | 23% | 32% | 40% | AKI-EPI, Intensive Care Med 2015, N=57,925 |
| AKI requiring dialysis | 45% | 55% | 62% | BEST Kidney, JAMA 2005, N=1,738 |
| OHCA (post-ROSC) | 75% | 80% | 83% | EuReCa ONE, N=10,682 |
| IHCA (post-ROSC) | 65% | 72% | 78% | GWTG-R (Merchant), N=433,985 |
| Bacterial meningitis | 20% | 25% | 30% | van de Beek, NEJM 2004, N=696 |
| COPD exacerbation (ICU) | 24% | 33% | 43% | SUPPORT, AJRCCM 1996, N=1,016 |
| COPD exacerbation (floor) | 4% | 10% | 22% | Steer, Thorax 2012, N=920 |
| Type A aortic dissection | 20% | 27% | 32% | IRAD, N=1,010 |
| Acute mesenteric ischaemia | 50% | 60% | 68% | Schoots meta-analysis, N=3,692 |
| Major trauma (ISS>15) | 15% | 20% | 25% | NTDB, N>1M |
| Febrile neutropenia | 5% | 10% | 20% | Kuderer, Cancer 2006, N=41,779 |
| Haematologic malignancy (ICU) | 45% | 55% | 65% | Azoulay, Crit Care Med 2013, N=1,011 |

---

## Risk Factor Evidence Standards

Every `RiskFactor` now carries:
- `evidence_timeframe` — the period the RR/OR was actually assessed at in the source study
- `primary_finding` — verbatim statistic from the paper (e.g. `"HR 1.46 (95% CI 1.39–1.54)"`)

### Hardcoded FallbackAgent factors and their sources

| Factor | Primary Finding | Source |
|---|---|---|
| Age ≥65 | RR ~1.4 vs age 50–60 (WHO Life Tables 2023) | WHO Global Health Estimates |
| Age ≥75 | RR ~2.0 (annual mortality ~6%) | WHO Global Health Estimates |
| Age ≥85 | RR ~3.0 (annual mortality ~15%) | WHO Global Health Estimates |
| CKD stage 3 | HR 1.7 (95% CI 1.6–1.8) eGFR 45–59 vs ≥60 | Go et al., NEJM 2004 |
| CKD stage 4 | HR 5.9 (95% CI 5.4–6.5) eGFR 15–29 | Go et al., NEJM 2004 |
| CHF HFrEF | 1-year mortality 17%; HR ~2.0 vs population | MAGGIC, Eur Heart J 2013 |
| AFib | HR 1.46 (95% CI 1.39–1.54) | Benjamin, Circulation 2018 (Framingham) |
| Cirrhosis | 1-yr mortality: ~1% compensated, ~57% 2nd decompensation | D'Amico, J Hepatol 2006 |
| Elevated lactate | OR 1.36 per 1 mmol/L (95% CI 1.21–1.54) | Casserly, Acad Emerg Med 2015 |
| AKI (Cr ≥2.0) | OR 6.2 (95% CI 5.0–7.6) any AKI vs none | Chertow, JASN 2005, N=9,210 |
| Troponin elevated | OR 1.84 (95% CI 1.32–2.56) non-ACS critical illness | Lim, Chest 2012 |
| Hypoalbuminaemia | OR 0.61 per 1 g/dL increase (inverse) | Vincent, Ann Surg 2003, N=7,337 |
| Vasopressors ≥2 | aOR ~4.0 for 28-day death | Levy, Intensive Care Med 2018, N=1,639 |
| Mechanical ventilation | OR 2.0 (95% CI 1.8–2.3) hospital death | Wunsch, AJRCCM 2010 |
| SOFA ≥6 | Score-to-mortality table (e.g. SOFA 12 → ~50%) | Ferreira, JAMA 2001, N=1,449 |
| APACHE II ≥15 | Score-to-mortality table (e.g. score 20–24 → ~40%) | Knaus, Crit Care Med 1985, N=5,815 |

---

## Extrapolation Labelling

- **30-day outcomes**: `is_extrapolated = False` — baseline is from published literature for that specific timeframe
- **90-day outcomes**: `is_extrapolated = True` with note explaining that risk-factor RRs (SOFA, APACHE II, comorbidities) are mostly validated at 30-day/in-hospital endpoints
- **1-year outcomes**: `is_extrapolated = True` with stronger note about post-discharge factors not captured

The 90d and 1yr **baselines** are now independently sourced from literature (not scaled multiples of 30d), so only the risk-factor adjustments on top carry the extrapolation caveat.

---

## Frontend Evidence Display

The results dashboard (`results-dashboard.tsx`) shows:

1. **Baseline Mortality Source card** — above outcome cards, shows `match_method` badge (green = published literature, blue = AI lookup, yellow = population estimate), source, verbatim finding in monospace box, population note and N
2. **Outcome cards** — yellow "Extrapolated" badge on 90d/1yr with inline note
3. **Risk Factor Breakdown table** — expandable, columns: Factor | Effect (RR% + raw RR) | Evidence Period | Confidence | Source + `primary_finding` in a highlighted monospace box

---

## LLM Agent Configuration

Priority order (set via environment variables):

| Priority | Env Var | Agent |
|---|---|---|
| 1 | `ANTHROPIC_API_KEY` | Claude (claude-sonnet-4-6 default) |
| 2 | `LLM_API_KEY` + `LLM_BASE_URL` | Any OpenAI-compatible API |
| 3 | (none) | FallbackAgent — rule-based, no API needed |

The `FallbackAgent` is fully functional and production-ready for offline use.

---

## Things to be aware of / known limitations

1. **Organ model ODEs are simplified approximations** — cross-organ coupling (cardiorenal syndrome, hepatorenal syndrome) is not modelled; each organ is independent
2. **Risk factor RRs are applied multiplicatively in log-odds space** — this can over-estimate risk in patients with many comorbidities; the current cap is `combined_rr ≤ 20x`
3. **Baseline matching is keyword-based** — a diagnosis like "multiorgan failure secondary to pneumonia" will match "pneumonia" not "sepsis"; consider adding diagnosis normalisation
4. **The 90d/1yr risk-factor adjustments are still extrapolated** — the baselines are sourced independently but the RR multipliers from SOFA/APACHE II are validated only in-hospital
5. **No sex-specific baseline adjustment yet** — some conditions (e.g. stroke, MI) have meaningful sex differences in short-term mortality that are not accounted for

---

## Session history summary

This project was built and iteratively improved across a single session:

- Fixed `@tailwindcss/postcss` missing from frontend `node_modules` (root-level lockfile conflict)
- Upgraded Node.js 20.3.1 → 25.8.1 via Homebrew (Next.js 16 requires ≥20.9.0)
- Connected organ model ODEs to population-level mortality via `mortality_estimate` parameter
- Added `evidence_timeframe` and `primary_finding` to all risk factors
- Added `is_extrapolated` + `extrapolation_note` to outcome predictions
- Replaced hardcoded admission-type baselines with a 40+ diagnosis literature lookup (`baseline.py`)
- All baselines verified and corrected against research agent findings (key corrections: CAP-ICU 22%→28%, PE 7%→11.4%, ICH 38%→40.4%, DKA 0.7%→0.4%, cirrhosis 20%→10%)
