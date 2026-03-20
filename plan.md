# Multi-Agent Diagnostic Simulator - Implementation Plan

## Overview
Build a `/diagnostic-conference` page where 9 specialist AI agents hold a structured 3-round diagnostic conference on clinical cases. Each agent is deeply grounded in real specialty guidelines, scoring systems, and landmark trials.

## New Dependency
- `@anthropic-ai/sdk` and `openai` (both providers, user-configurable)

## File Structure

```
lib/diagnostic-conference/
  types.ts                          # TypeScript interfaces
  specialists.ts                    # Specialist metadata (names, colors, icons)
  system-prompts/
    cardiology.ts                   # ACC/AHA guidelines, HEART score, PARADIGM-HF, DAPA-HF, ISCHEMIA trial
    pulmonology.ts                  # Berlin ARDS criteria, CURB-65, Wells PE, ARDSNet, PROSEVA
    neurology.ts                    # NIHSS, GCS, McDonald MS criteria, NINDS tPA, DAWN/DEFUSE-3
    nephrology.ts                   # KDIGO AKI/CKD staging, FENa, STARRT-AKI, AKIKI, DAPA-CKD
    hepatology.ts                   # MELD-Na, Child-Pugh, Maddrey DF, STOPAH, SHARP/IMbrave150
    gastroenterology.ts             # Glasgow-Blatchford, Revised Atlanta, BISAP, HALT-IT, SONIC
    infectious-disease.ts           # qSOFA, SOFA, Surviving Sepsis 2021, MERINO, ACORN
    hematology.ts                   # ISTH DIC score, PLASMIC/TTP, 4T HIT, TRICC, CARAVAGGIO
    surgery.ts                      # Alvarado, Hinchey, ATLS, FAST, CRASH-2, PROPPR, CODA
    index.ts                        # Barrel export
  conference-orchestrator.ts        # 3-round orchestration engine
  prebuilt-cases.ts                 # Pre-built clinical cases

app/api/diagnostic-conference/
  route.ts                          # SSE streaming API endpoint

app/(frontend)/diagnostic-conference/
  page.tsx                          # Main page
  components/
    conference-container.tsx        # State machine (input → running → complete)
    case-input-form.tsx             # Free-text case submission
    prebuilt-case-selector.tsx      # Pre-built case gallery
    specialist-panel.tsx            # Individual specialist card with streaming
    conference-round-header.tsx     # Round progress indicator
    conference-summary.tsx          # Round 3 synthesis view
    specialist-avatar.tsx           # Colored icon per specialty
```

## How Specialists Are "Trained"

Each system prompt contains **embedded clinical knowledge** (not instructions to "look up"):

### Universal Preamble (all 9 share)
```
You are a board-certified [SPECIALTY] consultant in a multi-disciplinary diagnostic conference.
CRITICAL RULES:
- Always cite the specific guideline, scoring system, or trial by name
- State numerical criteria when using scoring systems
- Reference society guidelines or landmark trials for recommendations
- If case doesn't involve your specialty, say so but note red flags
- In Round 2, directly engage with other specialists' assessments
```

### Per-Specialty Content (embedded in each prompt)

| Specialist | Scoring Systems | Landmark Trials | Guidelines |
|---|---|---|---|
| **Cardiology** | HEART score, CHA2DS2-VASc, Killip, TIMI | PARADIGM-HF, DAPA-HF, ISCHEMIA, COMPASS, EMPEROR-Preserved | 2022 AHA/ACC HF, 2021 ACC/AHA Chest Pain |
| **Pulmonology** | Berlin ARDS, CURB-65, Wells PE, GOLD, Light's criteria | ARDSNet/ARMA, PROSEVA, ACURASYS, ROSE, PIOPED II | 2023 GOLD, 2019 ATS/ERS ARDS |
| **Neurology** | NIHSS, GCS, Hunt-Hess, ABCD2, McDonald MS | NINDS tPA, ECASS III, MR CLEAN et al, DAWN, NASCET | 2019 AHA/ASA Stroke, 2017 ILAE Seizure |
| **Nephrology** | KDIGO AKI (Stages 1-3), KDIGO CKD (G1-G5/A1-A3), FENa/FEUrea, AEIOU dialysis | STARRT-AKI, AKIKI, CREDENCE, DAPA-CKD | 2024 KDIGO AKI/CKD |
| **Hepatology** | MELD-Na (formula), Child-Pugh, Maddrey DF, CLIF-SOFA, Baveno VII | STOPAH, SHARP, IMbrave150, ATTIRE | AASLD HBV/HCV/NAFLD, EASL Cirrhosis |
| **GI** | Glasgow-Blatchford, Rockall, Revised Atlanta, BISAP, Montreal IBD | HALT-IT, TRIGGER, PEPTIC, SONIC | ACG GI Bleeding, ACG Pancreatitis |
| **ID** | qSOFA, SOFA, Pitt Bacteremia, MASCC | SSC 2021, PRISM, ProCESS/ARISE/ProMISe, MERINO, ACORN | SSC 2021, IDSA MRSA/ESBL/C.diff |
| **Hematology** | ISTH DIC, PLASMIC TTP, 4T HIT, transfusion thresholds | TRICC, CLOT, CARAVAGGIO | ISTH DIC, ASH VTE/ITP, AABB Transfusion |
| **Surgery** | Alvarado, Hinchey, ATLS primary survey, FAST, ASA class | CODA, SCANDIV, CRASH-2, PROPPR, PANTER | ATLS 10th Ed, EAST, SAGES |

## Conference Flow (3 Rounds)

**Round 1 - Initial Assessment:** All 9 specialists analyze the case in parallel through their specialty lens. Each applies their scoring systems and identifies differentials.

**Round 2 - Cross-Specialty Discussion:** Each specialist receives all Round 1 outputs. They agree/disagree/refine. Hidden case data may be revealed (e.g., culture results).

**Round 3 - Synthesis:** A "Conference Chair" agent synthesizes all opinions into: ranked differential, agreed workup, areas of disagreement, and recommended immediate management.

## API Architecture

- Single SSE stream for entire conference (no reconnection between rounds)
- Multiplexed streaming: all 9 specialists stream in parallel within each round
- Events: `{ specialtyId, roundNumber, delta }`, `{ type: 'round_complete' }`, `{ type: 'conference_complete' }`
- Supports both Claude (Anthropic SDK) and GPT-4 (OpenAI SDK) via provider toggle
- BYOK (bring your own key) + optional server-side key with rate limiting

## Pre-Built Cases

1. **"The Crashing ICU Patient"** - Post-CABG septic shock with DIC, mesenteric ischemia, shock liver, AKI
2. **"The Diagnostic Puzzle"** - Young woman with lupus/TTP overlap
3. **"The Silent Killer"** - Cirrhosis with HCC and paraneoplastic syndrome

## UI Design

- Matches existing site: glassmorphic cards, backdrop-blur, cream/blue/teal palette
- Desktop: 3x3 grid of specialist panels
- Mobile: accordion-style, active specialist expanded
- Framer Motion stagger animations for panel entrance
- react-markdown for rendering specialist output
- Colored left border per specialty (red=cardio, blue=pulm, purple=neuro, etc.)

## Implementation Order

1. Types, specialist metadata, and all 9 system prompts
2. Conference orchestrator (server-side logic)
3. API route with SSE streaming
4. Pre-built cases
5. UI components (page, container, panels, case input)
6. Provider toggle (Claude/OpenAI) and BYOK support
7. Polish: animations, mobile responsiveness, error handling
