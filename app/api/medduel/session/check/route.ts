import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

/** GET — check if the user already attempted today's challenge */
export async function GET(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const fp = req.nextUrl.searchParams.get('fp')
  const challengeId = req.nextUrl.searchParams.get('challengeId')

  if (!fp || !challengeId) {
    return NextResponse.json({ attempted: false })
  }

  const { data: session } = await supabaseAdmin
    .from('user_sessions')
    .select('id, elo_rating, xp, level, streak_days, badges')
    .eq('fingerprint', fp)
    .single()

  if (!session) return NextResponse.json({ attempted: false })

  const { data: attempt } = await supabaseAdmin
    .from('attempts')
    .select('answers, ai_answers, score, ai_score, max_score, time_taken_seconds')
    .eq('session_id', session.id)
    .eq('daily_challenge_id', challengeId)
    .eq('completed', true)
    .single()

  if (!attempt) return NextResponse.json({ attempted: false })

  return NextResponse.json({
    attempted: true,
    result: {
      answers: attempt.answers,
      ai_answers: attempt.ai_answers,
      stats: {
        userScore: attempt.score,
        aiScore: attempt.ai_score,
        maxScore: attempt.max_score,
        xpGained: 0,
        eloChange: 0,
        newELO: session.elo_rating,
        newXP: session.xp,
        newLevel: session.level,
        newStreak: session.streak_days,
        newBadges: [],
        isPerfect: attempt.score === attempt.max_score && attempt.max_score > 0,
        beatsAI: attempt.score > attempt.ai_score,
      },
    },
  })
}
