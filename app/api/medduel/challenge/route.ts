import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/** GET /api/medduel/challenge — returns today's case with questions */
export async function GET() {
  const today = new Date().toISOString().split('T')[0]

  // Try to get today's scheduled challenge
  const { data: challenge, error } = await supabaseAdmin
    .from('daily_challenges')
    .select(`
      id,
      challenge_date,
      case_id,
      case:cases (
        id, title, raw_content, structured_vignette,
        source, source_url, difficulty, specialty,
        questions (
          id, question_text, type, options,
          correct_answer, explanation, order_index
        )
      )
    `)
    .eq('challenge_date', today)
    .single()

  if (error || !challenge) {
    // No challenge scheduled — pick a random active case
    const { data: randomCase } = await supabaseAdmin
      .from('cases')
      .select(`
        id, title, raw_content, structured_vignette,
        source, source_url, difficulty, specialty,
        questions (
          id, question_text, type, options,
          correct_answer, explanation, order_index
        )
      `)
      .eq('status', 'active')
      .order('RANDOM()')
      .limit(1)
      .single()

    if (!randomCase) {
      return NextResponse.json({ error: 'No cases available yet.' }, { status: 404 })
    }

    // Auto-schedule it as today's challenge
    const { data: newChallenge } = await supabaseAdmin
      .from('daily_challenges')
      .insert({ case_id: randomCase.id, challenge_date: today })
      .select()
      .single()

    return NextResponse.json({
      id: newChallenge?.id,
      challenge_date: today,
      case: {
        ...randomCase,
        questions: (randomCase as any).questions?.sort(
          (a: any, b: any) => a.order_index - b.order_index
        ),
      },
    })
  }

  const caseData = challenge.case as any
  return NextResponse.json({
    ...challenge,
    case: {
      ...caseData,
      questions: caseData?.questions?.sort(
        (a: any, b: any) => a.order_index - b.order_index
      ),
    },
  })
}
