# MortPred — Claude Context & Development Log

This file captures all architectural decisions, design rationale, and implementation details for the MortPred clinical mortality prediction tool. It exists so future Claude sessions have full context without needing to re-explore the codebase.

---

## Project Overview

**MortPred** is a bedside clinical decision support tool for evidence-based mortality and outcome prediction. It is **not** FDA-cleared and should not be used as a sole diagnostic instrument.

- **Frontend**: Integrated into the main `drchintandave` Next.js 15 site at `/clinical/mortality`
- **Backend**: Python FastAPI — runs on `localhost:8000` locally, deployed to Railway in production
- **No database** — stateless, per-request predictions

### Running locally
```bash
# Backend (from /backend)
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Frontend (from repo root /Users/chintandave/drchintandave)
npm run dev
```

Node.js ≥ 20.9.0 required (25.8.1 installed via Homebrew).

### Production deployment
- **Frontend**: Vercel (main drchintandave site). Set `NEXT_PUBLIC_MORTPRED_API_URL` to the Railway backend URL so the browser calls Railway directly (no Vercel timeout issue).
- **Backend**: Railway. Root directory = `mortality-predictor/backend`. Config in `backend/railway.toml`.
- **Backend env vars on Railway**: `ANTHROPIC_API_KEY`, `ALLOWED_ORIGINS` (comma-separated frontend origins)
- **Frontend env vars on Vercel**: `NEXT_PUBLIC_MORTPRED_API_URL=https://your-app.railway.app`

---

## Architecture

```
drchintandave/                          ← main Next.js 15 site (Vercel)
├── app/(frontend)/clinical/mortality/  ← MortPred page (page.tsx + mortpred.css)
├── lib/clinical/
│   ├── utils.ts                        API client; reads NEXT_PUBLIC_MORTPRED_API_URL
│   └── types.ts                        TypeScript types (mirrors backend Pydantic models)
└── components/clinical/
    ├── forms/patient-form.tsx
    └── results/results-dashboard.tsx, organ-chart.tsx

mortality-predictor/                    ← standalone backend repo subdirectory
└── backend/app/
    ├── main.py                         FastAPI app; CORS reads ALLOWED_ORIGINS env var
    ├── models/patient.py               Pydantic models (all data shapes)
    ├── routers/predict.py              POST /api/predict
    ├── scoring/calculators.py          SOFA, APACHE II, MELD, CHA₂DS₂-VASc, CURB-65
    ├── organ_models/compartment.py     Coupled ODE organ models (renal/cardiac/hepatic)
    ├── agents/research.py              LLM research agent (Anthropic / OpenAI / fallback)
    └── services/
        ├── prediction.py               Main orchestration pipeline
        └── baseline.py                 Diagnosis-stratified mortality baselines
```

### API routing
- Locally: `next.config.js` rewrites `/api/predict` → `http://localhost:8000/api/predict`
- Production: `lib/clinical/utils.ts` reads `NEXT_PUBLIC_MORTPRED_API_URL` (set in Vercel); if set, the browser calls Railway directly, bypassing Vercel's proxy entirely (avoids timeout)

---

## Prediction Pipeline (`services/prediction.py`)

Order of execution in `predict()`:

1. **Compute clinical scores** — SOFA, APACHE II, MELD, CHA₂DS₂-VASc, CURB-65 (where applicable)
2. **Run AI research agent** — returns `list[RiskFactor]` + narrative string
3. **Derive composite mortality estimate** — average of all `score.mortality_estimate` values; retained for context but organ models now use patient-specific parameter fitting instead
4. **Run organ models** — coupled ODE system (`run_organ_models(patient)`); patient-specific parameters fitted from actual labs/vitals/comorbidities
5. **Feed organ trajectories back into risk factors** — `_organ_severity_adjustment(organ_outputs)` appends projected organ deterioration as additional `RiskFactor` entries (e.g. "Projected AKI Progression", "Projected Refractory Shock")
6. **Get diagnosis-specific baseline** — from `baseline.py` (literature → LLM → admission-type fallback)
7. **Compute outcome predictions** — log-linear model blending risk factors + clinical scores against the diagnosis baseline
8. **Build response** — `PredictionResponse` with all fields including `baseline_info`

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

### `OrganModelOutput`
```python
organ_system: str               # "renal" | "cardiac" | "hepatic"
trajectory_hours: list[float]
trajectory_values: list[float]
parameter_name: str
parameter_unit: str
summary: str
severity_score: Optional[float]       # final organ severity 0–1
peak_value: Optional[float]           # worst value during trajectory
trend: Optional[str]                  # "worsening" | "improving" | "stable"
coupling_effects: Optional[list[str]] # active cross-organ interactions e.g. ["Cardiorenal syndrome"]
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

Full coupled ODE system — renal (creatinine), cardiac (MAP), hepatic (bilirubin) — with cross-organ coupling terms and patient-specific parameter fitting.

### Patient-specific parameter fitting
Each organ system has a dedicated `_fit_*_params()` function that derives parameters from actual patient data:

- **Renal** (`RenalParams`): creatinine → KDIGO severity; age-adjusted GFR decline (Lindeman 1985); CKD stage reduces baseline clearance; dialysis adds severity; BMI adjusts production; diabetes reduces recovery; lactate/procalcitonin further reduce recovery
- **Cardiac** (`CardiacParams`): MAP/SBP/DBP → severity; CHF subtype (HFrEF/HFpEF/general) adds severity; vasopressor count → pressor_effect; troponin/BNP elevation add severity; lactate >4 adds deterioration term
- **Hepatic** (`HepaticParams`): bilirubin → severity; INR as synthetic function marker; albumin as chronic marker; cirrhosis adds severity; AST/ALT elevations increase production; sepsis markers reduce recovery

### Cross-organ coupling (`_detect_coupling`)
Four coupling interactions modelled (all sourced from literature):

| Interaction | Trigger | Effect | Source |
|---|---|---|---|
| Cardiorenal | MAP < 70 or cardiac severity > 0.3 | Low MAP reduces renal clearance via sigmoid | Ronco, JACC 2008 |
| Hepatorenal | Hepatic severity > 0.4 or cirrhosis | High bilirubin → renal vasoconstriction | Ginès, Hepatology 2003 |
| Cardiohepatic | MAP < 65 or cardiac+hepatic severity | Low MAP → hepatic congestion | Alvarez & Mukherjee, Heart Failure Clin 2011 |
| Renal-cardiac | Creatinine > 3.0 or renal severity > 0.6 | Uremia depresses myocardium | Hatamizadeh, Cardiorenal Med 2013 |

### Simulation strategy
- **2+ organ systems with data** → full coupled 5-state ODE (`coupled_ode`): state vector `[creatinine, renal_clearance, MAP, bilirubin, hepatic_clearance]`
- **< 2 organ systems** → independent models (`_run_independent_models`) — same ODEs but without cross-organ terms
- Solver failure → fallback to independent models

### Organ trajectory → risk factors (`_organ_severity_adjustment`)
After simulation, projected trajectory endpoints feed back into the mortality calculation as additional `RiskFactor` entries:

| Condition | RR | Source |
|---|---|---|
| Creatinine rises >1.5× and >2.0 mg/dL | 1.8 | Chertow, JASN 2005 |
| Creatinine projected >4.0 mg/dL | 2.5 | Chertow, JASN 2005 |
| MAP projected <55 mmHg | 3.0 | Varpula, Crit Care 2005 |
| MAP projected 55–60 mmHg | 2.0 | Varpula, Crit Care 2005 |
| Bilirubin rises >2× and >3.0 mg/dL | 1.6 | Kramer & Jordan, Crit Care Med 2007 |
| Bilirubin projected >12 mg/dL | 2.2 | Kramer & Jordan, Crit Care Med 2007 |
| ≥3 organ systems worsening | 2.0 | Vincent, JAMA 2001 (SOFA trajectory) |
| 2 organ systems worsening | 1.5 | Vincent, JAMA 2001 |

### Organ models only run when relevant data is present
- Renal: only if `labs.creatinine` is provided
- Cardiac: only if `vitals.mean_arterial_pressure`, `vitals.heart_rate`, or `vitals.systolic_bp` is provided
- Hepatic: only if `labs.bilirubin_total` is provided

---

## Baseline Mortality Service (`services/baseline.py`)

Three-tier lookup replacing the original hardcoded admission-type averages:

### Tier 1: Literature match (40+ diagnoses)
Keyword matching against `_LITERATURE` — a list of `_Entry` objects, each with:
- Keywords to match against `primary_diagnosis` (case-insensitive)
- Setting filter (`["icu"]`, `["floor", "ed"]`, or `["any"]`)
- Independent 30d / 90d / 1yr mortality values from the specific study
- `severity_keywords` for two-pass matching (e.g. "septic shock" before "sepsis")
- Source, primary finding (verbatim), and N

**Matching is two-pass**: first tries entries that also match severity keywords (e.g. "shock"), then falls back to general entries.

### Tier 2: LLM agent lookup
If no literature match and an API key is configured (`ANTHROPIC_API_KEY` or `LLM_API_KEY`), calls the LLM with a strict prompt requiring a specific cited study and verbatim finding. Returns `match_method="llm"`.

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

Every `RiskFactor` carries:
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

The 90d and 1yr **baselines** are independently sourced from literature (not scaled multiples of 30d), so only the risk-factor adjustments on top carry the extrapolation caveat.

---

## Frontend Evidence Display

The results dashboard (`components/clinical/results/results-dashboard.tsx`) shows:

1. **Baseline Mortality Source card** — above outcome cards, shows `match_method` badge (green = published literature, blue = AI lookup, yellow = population estimate), source, verbatim finding in monospace box, population note and N
2. **Outcome cards** — yellow "Extrapolated" badge on 90d/1yr with inline note
3. **Risk Factor Breakdown table** — expandable, columns: Factor | Effect (RR% + raw RR) | Evidence Period | Confidence | Source + `primary_finding` in a highlighted monospace box
4. **Organ Model Projections** — rendered by `organ-chart.tsx`; summary includes cross-organ coupling effects if active

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

1. **Organ trajectory → risk factor feedback loop is one-directional** — organ model runs first using patient labs, then its endpoints become risk factors; there is no iterative convergence between the mortality estimate and the organ trajectories
2. **Risk factor RRs are applied multiplicatively in log-odds space** — this can over-estimate risk in patients with many comorbidities; the current cap is `combined_rr ≤ 20x`
3. **Baseline matching is keyword-based** — a diagnosis like "multiorgan failure secondary to pneumonia" will match "pneumonia" not "sepsis"; consider adding diagnosis normalisation
4. **The 90d/1yr risk-factor adjustments are still extrapolated** — the baselines are sourced independently but the RR multipliers from SOFA/APACHE II are validated only in-hospital
5. **No sex-specific baseline adjustment yet** — some conditions (e.g. stroke, MI) have meaningful sex differences in short-term mortality that are not accounted for
6. **Cross-organ coupling parameters are semi-empirical** — the sigmoid midpoints and coupling strengths are physiologically motivated but not individually calibrated to a validation dataset

---

## Session history summary

**Session 1** — initial build and evidence improvements:
- Fixed `@tailwindcss/postcss` missing from frontend `node_modules` (root-level lockfile conflict)
- Upgraded Node.js 20.3.1 → 25.8.1 via Homebrew (Next.js 16 requires ≥20.9.0)
- Connected organ model ODEs to population-level mortality via `mortality_estimate` parameter
- Added `evidence_timeframe` and `primary_finding` to all risk factors
- Added `is_extrapolated` + `extrapolation_note` to outcome predictions
- Replaced hardcoded admission-type baselines with 40+ diagnosis literature lookup (`baseline.py`)
- All baselines verified and corrected against research agent findings (key corrections: CAP-ICU 22%→28%, PE 7%→11.4%, ICH 38%→40.4%, DKA 0.7%→0.4%, cirrhosis 20%→10%)

**Session 2** — deployment prep and organ model upgrade:
- Added Railway deployment config (`backend/railway.toml`)
- Updated CORS to read `ALLOWED_ORIGINS` env var (comma-separated, configurable per environment)
- Merged upstream organ model rewrite: full coupled ODE system with patient-specific parameter fitting (RenalParams, CardiacParams, HepaticParams dataclasses), cross-organ coupling (cardiorenal, hepatorenal, cardiohepatic, renal-cardiac), and `_organ_severity_adjustment` feeding projected trajectory endpoints back into risk factors
- `OrganModelOutput` extended with `severity_score`, `peak_value`, `trend`, `coupling_effects` fields
- Production routing: `NEXT_PUBLIC_MORTPRED_API_URL` in Vercel points browser directly to Railway, bypassing Vercel proxy timeout
- Git identity configured: `cdave@qmed.ca` / Chintan Dave
