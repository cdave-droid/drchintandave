# MortPred — Clinical Mortality & Outcome Prediction Tool

Evidence-based mortality and clinical outcome prediction tool for bedside clinical decision support.

## Architecture

```
mortality-predictor/
├── frontend/          Next.js 16 + Tailwind CSS + Recharts
│   └── src/
│       ├── app/             Pages (patient form → results dashboard)
│       ├── components/      Form inputs, results cards, organ charts
│       ├── lib/             API client, utilities
│       └── types/           TypeScript types (mirrors backend models)
│
└── backend/           Python FastAPI
    └── app/
        ├── models/          Pydantic data models (PatientInput, PredictionResponse)
        ├── scoring/         Clinical calculators (SOFA, APACHE II, MELD, CHA₂DS₂-VASc, CURB-65)
        ├── organ_models/    Simplified ODE compartment models (renal, cardiac, hepatic)
        ├── agents/          LLM-agnostic research agent (Claude, OpenAI, or rule-based fallback)
        ├── services/        Prediction orchestration engine
        └── routers/         API endpoints
```

## Features

- **Validated Clinical Scores**: SOFA, APACHE II, MELD, CHA₂DS₂-VASc, CURB-65
- **AI Research Agent**: Analyzes patient factors against known mortality predictors with citations
- **Organ Modeling**: Simplified ODE-based renal, cardiac, and hepatic trajectory simulations
- **Comprehensive Outcomes**: Mortality (30d/90d/1yr), dialysis need, ventilator dependence, cardiac events, readmission, functional decline, and more
- **Evidence Presentation**: Narrative summary + expandable factor-by-factor table with relative risks and sources
- **Works Offline**: Rule-based fallback agent with established medical literature risk multipliers

## Quick Start

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Optional: copy .env.example to .env and add LLM API key
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3001 — the frontend proxies API calls to the backend at :8000.

## LLM Agent Configuration

The AI research agent supports three backends (set via environment variables):

| Priority | Env Var | Agent |
|----------|---------|-------|
| 1 | `ANTHROPIC_API_KEY` | Claude (Anthropic) |
| 2 | `LLM_API_KEY` + `LLM_BASE_URL` | Any OpenAI-compatible API |
| 3 | (none) | Rule-based fallback — no API needed |

## Disclaimers

- This tool is for **clinical decision support only** and does not replace physician judgment
- Not FDA-cleared or validated in prospective clinical trials
- All cited evidence should be independently verified
- Organ model trajectories are simplified approximations
