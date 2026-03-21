-- Game Schema Migration
-- Staged diagnostic game (DxArena-style)

-- Clinician accounts (email + NPI verification)
CREATE TABLE IF NOT EXISTS game_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  npi_number TEXT UNIQUE,
  npi_verified BOOLEAN DEFAULT FALSE,
  npi_name TEXT,
  npi_credentials TEXT,
  npi_specialty TEXT,
  auth_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW()
);

-- Game cases: each case has all stages pre-defined
--
-- patient_presentation JSONB:
--   { chief_complaint, history_of_present_illness, past_medical_history,
--     medications, allergies, social_history, family_history,
--     review_of_systems,
--     vitals: [{label, value}],
--     physical_exam: [{label, text}] }
--
-- differential_options JSONB: [{id, label}]  — at least 6 items
--
-- lab_options JSONB:
--   [{id, label, category, classification: 'KEY'|'NEUTRAL'|'MISLEADING',
--     result: {type: 'table'|'text', rows?: [{name,value,ref,abnormal}], text?} }]
--
-- focused_test_options JSONB:
--   [{id, label, category: 'bedside'|'imaging'|'lab',
--     result: {findings: string[], impression: string}}]
--
-- management_options JSONB: [{id, label, is_correct: bool}]
-- clincher_options  JSONB: [{id, label, is_correct: bool}]
--
-- expert_path JSONB:
--   { initial_dx: string[], final_dx: string,
--     key_labs: [{id, label, classification: 'KEY'|'NEUTRAL'}],
--     focused_tests: [{id, label}] }
CREATE TABLE IF NOT EXISTS game_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number INT,                -- e.g. 1 → "#001"
  title TEXT NOT NULL,
  department TEXT DEFAULT 'Emergency Dept',
  urgency TEXT DEFAULT 'EMERGENT', -- EMERGENT | URGENT | NON-URGENT
  specialty TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard', 'expert')) DEFAULT 'medium',
  status TEXT CHECK (status IN ('draft', 'active', 'archived')) DEFAULT 'draft',

  -- Stage 1
  patient_presentation JSONB NOT NULL,

  -- Stage 2: Differentials (≥6 options, allow 3 picks)
  differential_options JSONB NOT NULL,   -- [{id, label}]
  correct_differentials JSONB NOT NULL,  -- [id, ...] acceptable answers
  max_differentials INT DEFAULT 3,

  -- Stage 3: Labs
  lab_options JSONB NOT NULL,
  max_labs INT DEFAULT 3,

  -- Stage 5: Focused tests (one at a time)
  focused_test_options JSONB NOT NULL,

  -- Stage 6: Final diagnosis
  correct_diagnosis TEXT NOT NULL,       -- must match an id in differential_options

  -- Stage 7: Management
  management_question TEXT DEFAULT 'What is the most appropriate next step in management for this patient?',
  management_options JSONB NOT NULL,

  -- Stage 8: Clincher
  clincher_question TEXT,
  clincher_options JSONB,

  -- Results page
  diagnosis_explanation TEXT,            -- shown after completion
  expert_path JSONB,                     -- { initial_dx, final_dx, key_labs, focused_tests }

  -- Scoring weights (total should sum to ~760 to match screenshots)
  scoring JSONB DEFAULT '{
    "differential_correct_each": 50,
    "diagnosis_correct": 150,
    "lab_key_correct": 40,
    "lab_efficiency_bonus": 40,
    "focused_test_bonus": 40,
    "management_correct": 200,
    "clincher_correct": 50,
    "speed_max": 50
  }',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Game sessions: one per user per case play-through
CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES game_cases(id) ON DELETE CASCADE,

  -- Identity
  user_id UUID REFERENCES game_users(id) ON DELETE SET NULL,
  fingerprint TEXT,

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  time_taken_seconds INT,

  -- Stage 2: Initial differentials
  differentials_selected JSONB,   -- [{id, label, custom: bool, selected_at_seconds}]

  -- Differential change history (tracked across ALL stages)
  -- [{stage, action: 'add'|'remove', diff_id, diff_label, custom: bool, timestamp_seconds}]
  differential_history JSONB DEFAULT '[]',

  -- Final differential state at each stage (snapshots for research)
  -- [{stage, differentials: [{id,label,custom}], timestamp_seconds}]
  differential_snapshots JSONB DEFAULT '[]',

  -- Stage 3: Labs
  labs_ordered JSONB,   -- [{id, label, ordered_at_seconds}]

  -- Stage 5: Focused tests
  focused_tests_ordered JSONB,   -- [{id, label, category, ordered_at_seconds}]

  -- Stage 6: Final diagnosis
  final_diagnosis TEXT,
  final_diagnosis_label TEXT,
  diagnosis_changed BOOLEAN,     -- changed from initial differentials?

  -- Stage 7: Management
  management_selected TEXT,
  management_correct BOOLEAN,

  -- Stage 8: Clincher
  clincher_selected TEXT,
  clincher_correct BOOLEAN,

  -- Score breakdown
  score_diagnosis INT DEFAULT 0,
  score_workup INT DEFAULT 0,
  score_management INT DEFAULT 0,
  score_clincher INT DEFAULT 0,
  score_speed INT DEFAULT 0,
  score INT DEFAULT 0,
  max_score INT DEFAULT 760,
  percentile FLOAT,

  completed BOOLEAN DEFAULT FALSE,
  abandoned BOOLEAN DEFAULT FALSE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_game_cases_status ON game_cases(status);
CREATE INDEX IF NOT EXISTS idx_game_cases_number ON game_cases(case_number);
CREATE INDEX IF NOT EXISTS idx_game_sessions_case ON game_sessions(case_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_user ON game_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_fingerprint ON game_sessions(fingerprint);
CREATE INDEX IF NOT EXISTS idx_game_users_email ON game_users(email);
CREATE INDEX IF NOT EXISTS idx_game_users_npi ON game_users(npi_number);

-- Clinician leaderboard view (NPI-verified only)
CREATE OR REPLACE VIEW clinician_leaderboard AS
SELECT
  gu.id,
  gu.display_name,
  gu.npi_credentials,
  gu.npi_specialty,
  COUNT(gs.id) AS total_cases,
  ROUND(AVG(gs.score::NUMERIC / NULLIF(gs.max_score, 0) * 100), 1) AS avg_accuracy_pct,
  SUM(gs.score) AS total_score,
  MAX(gs.score) AS best_score,
  ROW_NUMBER() OVER (
    ORDER BY AVG(gs.score::NUMERIC / NULLIF(gs.max_score, 0)) DESC, COUNT(gs.id) DESC
  ) AS rank
FROM game_users gu
JOIN game_sessions gs ON gs.user_id = gu.id AND gs.completed = TRUE
WHERE gu.npi_verified = TRUE
GROUP BY gu.id, gu.display_name, gu.npi_credentials, gu.npi_specialty
ORDER BY avg_accuracy_pct DESC;
