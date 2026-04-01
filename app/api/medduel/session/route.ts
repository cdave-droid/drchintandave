import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import {
  getLevelInfo, getXPForCorrect, calculateELOChange, checkNewBadges, LEVELS,
} from '@/lib/gamification'

const AI_DOCTOR_ELO = 1350

/** GET — fetch or create a session by fingerprint */
export async function GET(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const fp = req.nextUrl.searchParams.get('fp')
  if (!fp) return NextResponse.json({ error: 'Missing fingerprint' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('user_sessions')
    .select('*')
    .eq('fingerprint', fp)
    .single()

  if (error || !data) {
    // Create new session
    const { data: newSession } = await supabaseAdmin
      .from('user_sessions')
      .insert({ fingerprint: fp })
      .select()
      .single()
    return NextResponse.json(newSession)
  }

  return NextResponse.json(data)
}

/** POST — submit an attempt and update session stats */
export async function POST(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  try {
    const {
      fingerprint,
      dailyChallengeId,
      caseId,
      answers,
      aiAnswers,
      questions,
      difficulty,
      timeTakenSeconds,
    } = await req.json()

    // Get or create session
    let { data: session } = await supabaseAdmin
      .from('user_sessions')
      .select('*')
      .eq('fingerprint', fingerprint)
      .single()

    if (!session) {
      const { data: newSession } = await supabaseAdmin
        .from('user_sessions')
        .insert({ fingerprint })
        .select()
        .single()
      session = newSession
    }

    if (!session) return NextResponse.json({ error: 'Session error' }, { status: 500 })

    // Check if already attempted today
    const { data: existing } = await supabaseAdmin
      .from('attempts')
      .select('id')
      .eq('session_id', session.id)
      .eq('daily_challenge_id', dailyChallengeId)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Already attempted today' }, { status: 409 })
    }

    // Calculate scores
    let userScore = 0
    let aiScore = 0
    let maxScore = 0

    const openGrades: Record<string, { score: number; feedback: string }> = {}

    for (const q of questions) {
      if (q.type === 'mcq') {
        maxScore += 1
        const userAns = (answers[q.id] ?? '').toUpperCase().trim()
        const aiAns = (aiAnswers?.[q.id] ?? '').toUpperCase().trim()
        const correct = q.options
          ?.find((o: any) => o.is_correct)
          ?.label?.toUpperCase() ?? ''

        if (userAns === correct) userScore += 1
        if (aiAns === correct) aiScore += 1
      }
      // Open-ended answers are graded async, handled via AI grade endpoint
    }

    const isPerfect = maxScore > 0 && userScore === maxScore
    const beatsAI = userScore > aiScore

    // XP calculation
    const xpGained = userScore > 0
      ? getXPForCorrect(difficulty, beatsAI) * userScore
      : 0

    // ELO change
    const eloChange = calculateELOChange(session.elo_rating, AI_DOCTOR_ELO, beatsAI)
    const newELO = Math.max(100, session.elo_rating + eloChange)
    const newXP = session.xp + xpGained
    const newLevel = LEVELS.findIndex(l => newXP >= l.minXP && newXP < l.maxXP) + 1 || 10

    // Streak
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const lastActive = session.last_active_date
    let newStreak = session.streak_days
    if (lastActive === yesterday) {
      newStreak = session.streak_days + 1
    } else if (lastActive !== today) {
      newStreak = 1
    }
    const newLongestStreak = Math.max(session.longest_streak, newStreak)

    // Badges
    const newSession = {
      ...session,
      elo_rating: newELO,
      xp: newXP,
      level: newLevel,
      streak_days: newStreak,
      total_attempts: session.total_attempts + 1,
      total_correct: session.total_correct + userScore,
    }
    const newBadges = checkNewBadges(newSession, { isPerfect, beatsAI, isExpertCase: difficulty === 'expert' })
    const allBadges = [...(session.badges ?? []), ...newBadges]

    // Save attempt
    const { data: attempt } = await supabaseAdmin
      .from('attempts')
      .insert({
        session_id: session.id,
        case_id: caseId,
        daily_challenge_id: dailyChallengeId,
        answers,
        ai_answers: aiAnswers,
        score: userScore,
        ai_score: aiScore,
        max_score: maxScore,
        completed: true,
        time_taken_seconds: timeTakenSeconds,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single()

    // Update session
    await supabaseAdmin
      .from('user_sessions')
      .update({
        elo_rating: newELO,
        xp: newXP,
        level: newLevel,
        streak_days: newStreak,
        longest_streak: newLongestStreak,
        last_active_date: today,
        total_attempts: session.total_attempts + 1,
        total_correct: session.total_correct + userScore,
        badges: allBadges,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id)

    return NextResponse.json({
      attempt,
      stats: {
        userScore,
        aiScore,
        maxScore,
        xpGained,
        eloChange,
        newELO,
        newXP,
        newLevel,
        newStreak,
        newBadges,
        isPerfect,
        beatsAI,
      },
    })
  } catch (err) {
    console.error('[Session POST Error]', err)
    return NextResponse.json({ error: 'Failed to submit attempt' }, { status: 500 })
  }
}

/** PATCH — update display name */
export async function PATCH(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const { fingerprint, displayName } = await req.json()
  if (!fingerprint || !displayName) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  await supabaseAdmin
    .from('user_sessions')
    .update({ display_name: displayName.slice(0, 30) })
    .eq('fingerprint', fingerprint)

  return NextResponse.json({ ok: true })
}
