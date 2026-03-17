'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, Bot, Clock, Flame } from 'lucide-react'
import { getFingerprint } from '@/lib/fingerprint'
import type { DailyChallenge, UserSession } from '@/lib/supabase'
import { CaseCard } from '@/components/medduel/CaseCard'
import { QuestionForm } from '@/components/medduel/QuestionForm'
import { ResultReveal } from '@/components/medduel/ResultReveal'
import { ELODisplay } from '@/components/medduel/ELODisplay'
import { XPBar } from '@/components/medduel/XPBar'

type GameState = 'loading' | 'ready' | 'answering' | 'waiting_ai' | 'done' | 'already_done' | 'error'

export default function MedDuelPage() {
  const [state, setState] = useState<GameState>('loading')
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null)
  const [session, setSession] = useState<UserSession | null>(null)
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({})
  const [aiAnswers, setAiAnswers] = useState<Record<string, string>>({})
  const [aiReasoning, setAiReasoning] = useState<Record<string, string>>({})
  const [resultStats, setResultStats] = useState<any>(null)
  const [error, setError] = useState('')
  const [startTime, setStartTime] = useState<number>(0)
  const [displayName, setDisplayName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [countdown, setCountdown] = useState('')

  // Countdown to midnight
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const midnight = new Date()
      midnight.setHours(24, 0, 0, 0)
      const diff = midnight.getTime() - now.getTime()
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(`${h}h ${m}m ${s}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const load = useCallback(async () => {
    const fp = getFingerprint()

    const [challengeRes, sessionRes] = await Promise.all([
      fetch('/api/medduel/challenge'),
      fetch(`/api/medduel/session?fp=${fp}`),
    ])

    if (!challengeRes.ok) {
      setError('No cases available yet. Check back soon!')
      setState('error')
      return
    }

    const challengeData: DailyChallenge = await challengeRes.json()
    const sessionData: UserSession = await sessionRes.json()

    setChallenge(challengeData)
    setSession(sessionData)
    setDisplayName(sessionData.display_name)

    // Check if already attempted today
    const attemptRes = await fetch(
      `/api/medduel/session/check?fp=${fp}&challengeId=${challengeData.id}`
    )
    if (attemptRes.ok) {
      const { attempted, result } = await attemptRes.json()
      if (attempted && result) {
        setUserAnswers(result.answers ?? {})
        setAiAnswers(result.ai_answers ?? {})
        setResultStats(result.stats ?? {})
        setState('already_done')
        return
      }
    }

    setState('ready')
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSubmit(answers: Record<string, string>) {
    if (!challenge) return
    setUserAnswers(answers)
    setState('waiting_ai')

    // Call AI simultaneously
    const aiRes = await fetch('/api/medduel/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseContent: challenge.case.raw_content,
        questions: challenge.case.questions,
      }),
    })

    const aiData = await aiRes.json()
    setAiAnswers(aiData.answers ?? {})
    setAiReasoning(aiData.reasoning ?? {})

    // Submit to server
    const timeTaken = Math.round((Date.now() - startTime) / 1000)
    const fp = getFingerprint()

    const sessionRes = await fetch('/api/medduel/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fingerprint: fp,
        dailyChallengeId: challenge.id,
        caseId: challenge.case_id,
        answers,
        aiAnswers: aiData.answers ?? {},
        questions: challenge.case.questions,
        difficulty: challenge.case.difficulty,
        timeTakenSeconds: timeTaken,
      }),
    })

    if (sessionRes.status === 409) {
      // Already submitted
      setState('already_done')
      return
    }

    const sessionResult = await sessionRes.json()
    setResultStats(sessionResult.stats)
    setSession(prev => prev ? {
      ...prev,
      elo_rating: sessionResult.stats.newELO,
      xp: sessionResult.stats.newXP,
      level: sessionResult.stats.newLevel,
      streak_days: sessionResult.stats.newStreak,
      badges: [...(prev.badges ?? []), ...(sessionResult.stats.newBadges ?? [])],
    } : prev)
    setState('done')
  }

  async function saveName() {
    if (!nameInput.trim()) return
    const fp = getFingerprint()
    await fetch('/api/medduel/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint: fp, displayName: nameInput.trim() }),
    })
    setDisplayName(nameInput.trim())
    setEditingName(false)
  }

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="text-center py-24">
        <Bot className="w-12 h-12 text-white/20 mx-auto mb-4" />
        <p className="text-white/50">{error}</p>
      </div>
    )
  }

  return (
    <div className="grid lg:grid-cols-[1fr_280px] gap-8">
      {/* Main game column */}
      <div className="space-y-6">
        {/* Hero */}
        <div className="text-center py-6">
          <h1 className="text-3xl font-extrabold tracking-tight">
            <span className="text-white">Med</span>
            <span className="text-emerald-400">Duel</span>
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Can you outdiagnose the AI doctor?
          </p>
        </div>

        {challenge && (
          <>
            <CaseCard caseData={challenge.case} />

            {state === 'ready' && (
              <QuestionForm
                questions={challenge.case.questions}
                onSubmit={answers => {
                  setStartTime(Date.now())
                  handleSubmit(answers)
                }}
              />
            )}

            {state === 'answering' && (
              <QuestionForm
                questions={challenge.case.questions}
                onSubmit={handleSubmit}
              />
            )}

            {state === 'waiting_ai' && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center space-y-3">
                <Bot className="w-10 h-10 text-blue-400 mx-auto animate-pulse" />
                <p className="text-white/70 font-medium">AI Doctor is answering...</p>
                <p className="text-white/30 text-sm">Consulting the medical literature</p>
              </div>
            )}

            {(state === 'done' || state === 'already_done') && resultStats && (
              <ResultReveal
                questions={challenge.case.questions}
                userAnswers={userAnswers}
                aiAnswers={aiAnswers}
                aiReasoning={aiReasoning}
                stats={resultStats}
                allBadges={session?.badges ?? []}
              />
            )}

            {state === 'already_done' && !resultStats && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                <p className="text-white/50 mb-2">You already completed today's challenge!</p>
                <p className="text-white/30 text-sm">Next case in: <span className="text-emerald-400 font-mono">{countdown}</span></p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Sidebar */}
      <aside className="space-y-4">
        {/* Player card */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            {editingName ? (
              <div className="flex items-center gap-2 w-full">
                <input
                  className="flex-1 bg-white/10 rounded-lg px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveName() }}
                  autoFocus
                  maxLength={30}
                />
                <button onClick={saveName} className="text-emerald-400 text-xs hover:text-emerald-300">Save</button>
                <button onClick={() => setEditingName(false)} className="text-white/30 text-xs">Cancel</button>
              </div>
            ) : (
              <>
                <span className="font-semibold text-sm">{displayName || 'Anonymous'}</span>
                <button
                  onClick={() => { setNameInput(displayName); setEditingName(true) }}
                  className="text-xs text-white/30 hover:text-white/60"
                >
                  rename
                </button>
              </>
            )}
          </div>

          {session && (
            <>
              <ELODisplay elo={session.elo_rating} />
              <XPBar xp={session.xp} level={session.level} />
              <div className="flex justify-between text-xs text-white/40 pt-1">
                <span>
                  <Flame className="w-3 h-3 inline mr-1 text-orange-400" />
                  {session.streak_days} day streak
                </span>
                <span>{session.total_correct}/{session.total_attempts} correct</span>
              </div>
            </>
          )}
        </div>

        {/* Daily countdown */}
        {(state === 'done' || state === 'already_done') && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <Clock className="w-5 h-5 text-white/30 mx-auto mb-2" />
            <p className="text-white/40 text-xs mb-1">Next case in</p>
            <p className="font-mono text-emerald-400 font-bold">{countdown}</p>
          </div>
        )}

        {/* AI Doctor card */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-blue-300">AI Doctor</span>
          </div>
          <p className="text-xs text-white/40">Powered by Claude</p>
          <p className="text-xs text-white/40">ELO: <span className="text-blue-400 font-semibold">1350</span></p>
          <p className="text-xs text-white/30 mt-2">The AI answers every case simultaneously — no peeking!</p>
        </div>

        {/* How to play */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">How to Play</h3>
          <ul className="space-y-1.5 text-xs text-white/50">
            <li>📋 Read the medical case carefully</li>
            <li>💡 Answer all questions before submitting</li>
            <li>🤖 See how you stack up against the AI</li>
            <li>🔥 Build streaks for bonus XP</li>
            <li>🏆 Climb the leaderboard</li>
            <li>⏰ One new case every day</li>
          </ul>
        </div>
      </aside>
    </div>
  )
}
