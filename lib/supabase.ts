import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side client with service role (for admin operations)
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? supabaseAnonKey
)

export type Case = {
  id: string
  title: string
  raw_content: string
  structured_vignette: StructuredVignette | null
  source: 'reddit' | 'medqa' | 'pubmed' | 'custom' | 'community'
  source_url: string | null
  difficulty: 'easy' | 'medium' | 'hard' | 'expert'
  specialty: string | null
  status: 'pending' | 'active' | 'archived' | 'rejected'
  upvotes: number
  created_at: string
}

export type StructuredVignette = {
  patient: string
  chief_complaint: string
  history: string
  vitals?: string
  labs_imaging?: string
  physical_exam?: string
}

export type Question = {
  id: string
  case_id: string
  question_text: string
  type: 'mcq' | 'open'
  options: MCQOption[] | null
  correct_answer: string | null
  explanation: string | null
  order_index: number
}

export type MCQOption = {
  label: string
  text: string
  is_correct: boolean
}

export type DailyChallenge = {
  id: string
  case_id: string
  challenge_date: string
  case: Case & { questions: Question[] }
}

export type UserSession = {
  id: string
  fingerprint: string
  display_name: string
  elo_rating: number
  xp: number
  level: number
  streak_days: number
  longest_streak: number
  last_active_date: string | null
  total_attempts: number
  total_correct: number
  badges: Badge[]
}

export type Badge = {
  id: string
  name: string
  description: string
  icon: string
  earned_at: string
}

export type Attempt = {
  id: string
  session_id: string
  case_id: string
  daily_challenge_id: string | null
  answers: Record<string, string>
  ai_answers: Record<string, string> | null
  score: number
  ai_score: number
  max_score: number
  completed: boolean
  time_taken_seconds: number | null
  created_at: string
  completed_at: string | null
}
