-- MedDuel Schema Migration

-- Cases table: stores all medical cases
CREATE TABLE IF NOT EXISTS cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  raw_content TEXT NOT NULL,
  structured_vignette JSONB,  -- AI-generated structured version
  source TEXT NOT NULL DEFAULT 'custom', -- 'reddit', 'medqa', 'pubmed', 'custom', 'community'
  source_url TEXT,
  source_id TEXT,  -- original post ID to avoid duplication
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard', 'expert')) DEFAULT 'medium',
  specialty TEXT,  -- cardiology, neurology, etc.
  status TEXT CHECK (status IN ('pending', 'active', 'archived', 'rejected')) DEFAULT 'pending',
  upvotes INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by TEXT
);

-- Questions table: MCQ or open-ended, linked to a case
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  type TEXT CHECK (type IN ('mcq', 'open')) NOT NULL DEFAULT 'mcq',
  options JSONB,  -- [{label: 'A', text: '...', is_correct: true}, ...]
  correct_answer TEXT,
  explanation TEXT,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily challenges: one case featured per day
CREATE TABLE IF NOT EXISTS daily_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  challenge_date DATE NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User sessions: fingerprint-based, no account needed
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT NOT NULL UNIQUE,
  display_name TEXT DEFAULT 'Anonymous',
  elo_rating INT DEFAULT 1000,
  xp INT DEFAULT 0,
  level INT DEFAULT 1,
  streak_days INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  last_active_date DATE,
  total_attempts INT DEFAULT 0,
  total_correct INT DEFAULT 0,
  badges JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attempts: one attempt per session per daily challenge
CREATE TABLE IF NOT EXISTS attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES user_sessions(id) ON DELETE CASCADE,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  daily_challenge_id UUID REFERENCES daily_challenges(id) ON DELETE SET NULL,
  answers JSONB NOT NULL DEFAULT '{}',  -- {question_id: answer_text}
  ai_answers JSONB,                      -- Claude's answers for comparison
  score INT DEFAULT 0,         -- user score
  ai_score INT DEFAULT 0,      -- AI score
  max_score INT DEFAULT 0,
  open_answer_grade JSONB,     -- AI grading of open-ended answers
  completed BOOLEAN DEFAULT FALSE,
  time_taken_seconds INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(session_id, daily_challenge_id)
);

-- Community case submissions (pre-approval queue)
CREATE TABLE IF NOT EXISTS submitted_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitter_name TEXT,
  submitter_email TEXT,
  title TEXT NOT NULL,
  raw_content TEXT NOT NULL,
  specialty TEXT,
  source_url TEXT,
  notes TEXT,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  rejection_reason TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_source ON cases(source);
CREATE INDEX IF NOT EXISTS idx_daily_challenges_date ON daily_challenges(challenge_date);
CREATE INDEX IF NOT EXISTS idx_attempts_session ON attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_attempts_case ON attempts(case_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_fingerprint ON user_sessions(fingerprint);
CREATE INDEX IF NOT EXISTS idx_user_sessions_elo ON user_sessions(elo_rating DESC);

-- View: leaderboard
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  us.id,
  us.display_name,
  us.elo_rating,
  us.xp,
  us.level,
  us.streak_days,
  us.total_attempts,
  us.total_correct,
  CASE WHEN us.total_attempts > 0
    THEN ROUND((us.total_correct::NUMERIC / us.total_attempts) * 100, 1)
    ELSE 0
  END AS accuracy_pct,
  us.badges,
  ROW_NUMBER() OVER (ORDER BY us.elo_rating DESC) AS rank
FROM user_sessions us
WHERE us.total_attempts > 0
ORDER BY us.elo_rating DESC;
