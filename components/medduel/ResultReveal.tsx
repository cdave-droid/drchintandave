'use client'

import { CheckCircle2, XCircle, Minus, Bot, User } from 'lucide-react'
import type { Question } from '@/lib/supabase'
import type { Badge } from '@/lib/supabase'
import { BadgeDisplay } from './BadgeDisplay'
import { ELODisplay } from './ELODisplay'
import { XPBar } from './XPBar'

interface Stats {
  userScore: number
  aiScore: number
  maxScore: number
  xpGained: number
  eloChange: number
  newELO: number
  newXP: number
  newLevel: number
  newStreak: number
  newBadges: Badge[]
  isPerfect: boolean
  beatsAI: boolean
}

interface Props {
  questions: Question[]
  userAnswers: Record<string, string>
  aiAnswers: Record<string, string>
  aiReasoning?: Record<string, string>
  stats: Stats
  allBadges: Badge[]
}

function AnswerRow({
  label,
  answer,
  correct,
  isCorrect,
  icon: Icon,
  color,
}: {
  label: string
  answer: string
  correct?: string
  isCorrect: boolean | null
  icon: typeof User
  color: string
}) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg ${color}`}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="text-xs text-white/50 mb-0.5">{label}</p>
        <p className="text-sm font-medium">{answer || <span className="italic text-white/30">No answer</span>}</p>
      </div>
      {isCorrect !== null && (
        <div className="shrink-0">
          {isCorrect ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <XCircle className="w-4 h-4 text-red-400" />
          )}
        </div>
      )}
    </div>
  )
}

export function ResultReveal({ questions, userAnswers, aiAnswers, aiReasoning, stats, allBadges }: Props) {
  const win = stats.beatsAI
  const tie = stats.userScore === stats.aiScore

  return (
    <div className="space-y-6">
      {/* Outcome banner */}
      <div className={`rounded-2xl p-6 text-center border ${
        win
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : tie
          ? 'bg-amber-500/10 border-amber-500/30'
          : 'bg-red-500/10 border-red-500/30'
      }`}>
        <div className="text-4xl mb-2">
          {win ? '🏆' : tie ? '🤝' : '🤖'}
        </div>
        <h3 className="text-xl font-bold mb-1">
          {win ? 'You beat the AI!' : tie ? "It's a tie!" : 'AI wins this round'}
        </h3>
        <p className="text-white/50 text-sm">
          You: {stats.userScore}/{stats.maxScore} &nbsp;|&nbsp; AI: {stats.aiScore}/{stats.maxScore}
        </p>

        {/* Stat chips */}
        <div className="flex justify-center gap-3 mt-4 flex-wrap">
          <div className="bg-white/10 rounded-full px-3 py-1 text-xs">
            +{stats.xpGained} XP
          </div>
          <div className={`rounded-full px-3 py-1 text-xs ${stats.eloChange >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
            {stats.eloChange >= 0 ? '+' : ''}{stats.eloChange} ELO
          </div>
          {stats.newStreak > 1 && (
            <div className="bg-orange-500/20 text-orange-400 rounded-full px-3 py-1 text-xs">
              🔥 {stats.newStreak} day streak
            </div>
          )}
          {stats.isPerfect && (
            <div className="bg-amber-500/20 text-amber-400 rounded-full px-3 py-1 text-xs">
              🎯 Perfect!
            </div>
          )}
        </div>
      </div>

      {/* New badges */}
      {stats.newBadges.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-amber-400 mb-3">New Badges Earned!</h4>
          <BadgeDisplay badges={[]} newBadges={stats.newBadges} />
        </div>
      )}

      {/* ELO & XP */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
        <ELODisplay elo={stats.newELO} change={stats.eloChange} />
        <XPBar xp={stats.newXP} level={stats.newLevel} />
      </div>

      {/* Question breakdown */}
      <div className="space-y-4">
        <h4 className="font-semibold text-white/70 text-sm uppercase tracking-wider">
          Question Breakdown
        </h4>
        {questions.map((q, i) => {
          const correctLabel = q.type === 'mcq'
            ? q.options?.find(o => o.is_correct)?.label?.toUpperCase() ?? q.correct_answer
            : q.correct_answer

          const userAns = userAnswers[q.id] ?? ''
          const aiAns = aiAnswers[q.id] ?? ''

          const userCorrect = q.type === 'mcq'
            ? userAns.toUpperCase() === correctLabel?.toUpperCase()
            : null

          const aiCorrect = q.type === 'mcq'
            ? aiAns.toUpperCase() === correctLabel?.toUpperCase()
            : null

          return (
            <div key={q.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10">
                <p className="text-sm font-medium">
                  <span className="text-emerald-400 mr-2">Q{i + 1}.</span>
                  {q.question_text}
                </p>
              </div>
              <div className="p-4 space-y-2">
                <AnswerRow
                  label="Your Answer"
                  answer={userAns}
                  correct={correctLabel ?? undefined}
                  isCorrect={userCorrect}
                  icon={User}
                  color={userCorrect === true ? 'bg-emerald-500/10' : userCorrect === false ? 'bg-red-500/10' : 'bg-white/5'}
                />
                <AnswerRow
                  label="AI Doctor"
                  answer={aiAns}
                  correct={correctLabel ?? undefined}
                  isCorrect={aiCorrect}
                  icon={Bot}
                  color={aiCorrect === true ? 'bg-blue-500/10' : aiCorrect === false ? 'bg-red-500/10' : 'bg-white/5'}
                />
                {q.type === 'mcq' && correctLabel && (
                  <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-white/5 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <p className="text-xs text-white/60">
                      <span className="text-emerald-400 font-medium">Correct: {correctLabel}. </span>
                      {q.options?.find(o => o.label.toUpperCase() === correctLabel?.toUpperCase())?.text}
                    </p>
                  </div>
                )}
                {q.explanation && (
                  <div className="mt-2 px-3 py-2 bg-blue-500/10 rounded-lg">
                    <p className="text-xs text-blue-300/80">
                      <span className="font-semibold text-blue-400">Explanation: </span>
                      {q.explanation}
                    </p>
                  </div>
                )}
                {aiReasoning?.[q.id] && (
                  <div className="mt-2 px-3 py-2 bg-purple-500/10 rounded-lg">
                    <p className="text-xs text-purple-300/80">
                      <span className="font-semibold text-purple-400">AI Reasoning: </span>
                      {aiReasoning[q.id]}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* All badges */}
      {allBadges.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wider">Your Badges</h4>
          <BadgeDisplay badges={allBadges} newBadges={stats.newBadges} />
        </div>
      )}

      <p className="text-center text-white/30 text-xs">
        Come back tomorrow for a new case!
      </p>
    </div>
  )
}
