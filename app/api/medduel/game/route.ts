import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { MOCK_CASE } from '@/lib/gameTypes'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET — fetch active case (or specific case by id, or ?demo=1 for mock)
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('demo') === '1') {
    return NextResponse.json({ case: MOCK_CASE, demo: true })
  }

  const caseId = req.nextUrl.searchParams.get('case_id')

  let query = supabase.from('game_cases').select('*').eq('status', 'active')
  if (caseId) query = query.eq('id', caseId)

  const { data, error } = await query
    .order('case_number', { ascending: true })
    .limit(1)
    .single()

  if (error || !data) {
    // Fallback to mock so the game always works
    return NextResponse.json({ case: MOCK_CASE, demo: true })
  }

  return NextResponse.json({ case: data })
}

// POST — create a game session
export async function POST(req: NextRequest) {
  const { case_id, fingerprint, user_id, demo } = await req.json()

  if (demo) {
    return NextResponse.json({ session: { id: `demo-${Date.now()}`, case_id, demo: true } })
  }

  if (!case_id) return NextResponse.json({ error: 'case_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('game_sessions')
    .insert({ case_id, fingerprint: fingerprint || null, user_id: user_id || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ session: data })
}

// PATCH — update session with stage data; calculate score when completed=true
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { session_id, demo, ...updates } = body

  if (demo) {
    // Score locally for demo sessions
    if (updates.completed) {
      const gc = MOCK_CASE as any
      const breakdown = calculateBreakdown(updates, gc)
      const percentile = 75 // demo default
      return NextResponse.json({
        session: {
          id: session_id,
          ...updates,
          ...breakdown,
          percentile,
          completed_at: new Date().toISOString(),
        },
      })
    }
    return NextResponse.json({ session: { id: session_id, ...updates } })
  }

  if (!session_id) return NextResponse.json({ error: 'session_id required' }, { status: 400 })

  if (updates.completed) {
    const { data: session } = await supabase
      .from('game_sessions')
      .select('*, game_cases(*)')
      .eq('id', session_id)
      .single()

    if (session) {
      const gc = session.game_cases
      const merged = { ...session, ...updates }

      if (gc) {
        const breakdown = calculateBreakdown(merged, gc)
        Object.assign(updates, breakdown)
        updates.completed_at = new Date().toISOString()

        // Management correctness
        const mgmtOpts: { id: string; is_correct: boolean }[] = gc.management_options || []
        const selMgmt = updates.management_selected ?? session.management_selected
        updates.management_correct = mgmtOpts.find(o => o.id === selMgmt)?.is_correct ?? false

        // Clincher correctness
        const clinOpts: { id: string; is_correct: boolean }[] = gc.clincher_options || []
        const selClin = updates.clincher_selected ?? session.clincher_selected
        updates.clincher_correct = clinOpts.find(o => o.id === selClin)?.is_correct ?? false

        // Did final dx differ from initial differentials?
        const initDiffs: { id: string }[] = merged.differentials_selected || []
        const finalDx = updates.final_diagnosis ?? session.final_diagnosis
        updates.diagnosis_changed = !initDiffs.map((d: { id: string }) => d.id).includes(finalDx)

        // Final diagnosis label
        const diffOpts: { id: string; label: string }[] = gc.differential_options || []
        const finalOpt = diffOpts.find((d: { id: string }) => d.id === finalDx)
        updates.final_diagnosis_label = finalOpt?.label ?? finalDx

        // Percentile
        const { data: others } = await supabase
          .from('game_sessions')
          .select('score')
          .eq('case_id', session.case_id)
          .eq('completed', true)
          .neq('id', session_id)

        if (others && others.length > 0) {
          const below = others.filter((o: { score: number }) => o.score < updates.score).length
          updates.percentile = Math.round((below / others.length) * 100)
        } else {
          updates.percentile = 99
        }
      }
    }
  }

  const { data, error } = await supabase
    .from('game_sessions')
    .update(updates)
    .eq('id', session_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ session: data })
}

// ── Score calculation ──────────────────────────────────────────────────────────

interface ScoringWeights {
  differential_correct_each: number
  diagnosis_correct: number
  lab_key_correct: number
  lab_efficiency_bonus: number
  focused_test_bonus: number
  management_correct: number
  clincher_correct: number
  speed_max: number
}

interface GameCase {
  scoring: ScoringWeights
  correct_differentials: string[]
  correct_diagnosis: string
  lab_options: { id: string; classification?: string }[]
  management_options: { id: string; is_correct: boolean }[]
  clincher_options: { id: string; is_correct: boolean }[]
  max_labs: number
}

interface SessionData {
  differentials_selected?: { id: string }[]
  labs_ordered?: { id: string }[]
  focused_tests_ordered?: { id: string }[]
  final_diagnosis?: string
  management_selected?: string
  clincher_selected?: string
  time_taken_seconds?: number
}

function calculateBreakdown(session: SessionData, gc: GameCase) {
  const w: ScoringWeights = gc.scoring || {
    differential_correct_each: 50,
    diagnosis_correct: 150,
    lab_key_correct: 40,
    lab_efficiency_bonus: 40,
    focused_test_bonus: 40,
    management_correct: 200,
    clincher_correct: 50,
    speed_max: 50,
  }

  // DIAGNOSIS score
  let scoreDiagnosis = 0
  const correctDiffs: string[] = gc.correct_differentials || []
  const selectedDiffs: { id: string }[] = session.differentials_selected || []
  for (const d of selectedDiffs) {
    if (correctDiffs.includes(d.id)) scoreDiagnosis += w.differential_correct_each
  }
  if (session.final_diagnosis === gc.correct_diagnosis) scoreDiagnosis += w.diagnosis_correct

  // WORKUP score
  let scoreWorkup = 0
  const orderedLabs: { id: string }[] = session.labs_ordered || []
  const labOpts: { id: string; classification?: string }[] = gc.lab_options || []
  for (const lab of orderedLabs) {
    const opt = labOpts.find(l => l.id === lab.id)
    if (opt?.classification === 'KEY') scoreWorkup += w.lab_key_correct
  }
  if (orderedLabs.length <= Math.ceil((gc.max_labs || 3) / 2)) scoreWorkup += w.lab_efficiency_bonus
  if ((session.focused_tests_ordered || []).length > 0) scoreWorkup += w.focused_test_bonus

  // MANAGEMENT score
  let scoreManagement = 0
  const mgmtOpts: { id: string; is_correct: boolean }[] = gc.management_options || []
  if (mgmtOpts.find(o => o.id === session.management_selected)?.is_correct) {
    scoreManagement = w.management_correct
  }

  // CLINCHER score
  let scoreClincher = 0
  const clinOpts: { id: string; is_correct: boolean }[] = gc.clincher_options || []
  if (clinOpts.find(o => o.id === session.clincher_selected)?.is_correct) {
    scoreClincher = w.clincher_correct
  }

  // SPEED score
  const t = session.time_taken_seconds ?? 600
  const scoreSpeed =
    t <= 90 ? w.speed_max : t >= 480 ? 0 : Math.round(w.speed_max * (1 - (t - 90) / 390))

  const score = scoreDiagnosis + scoreWorkup + scoreManagement + scoreClincher + scoreSpeed

  return {
    score_diagnosis: scoreDiagnosis,
    score_workup: scoreWorkup,
    score_management: scoreManagement,
    score_clincher: scoreClincher,
    score_speed: scoreSpeed,
    score,
    max_score: 760,
  }
}
