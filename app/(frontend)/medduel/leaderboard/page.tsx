'use client'

import { useEffect, useState } from 'react'
import { Trophy, Loader2, TrendingUp } from 'lucide-react'
import Link from 'next/link'

type LeaderboardEntry = {
  id: string
  display_name: string
  elo_rating: number
  xp: number
  level: number
  streak_days: number
  total_attempts: number
  accuracy_pct: number
  badges: Array<{ icon: string }>
  rank: number
}

function getRankStyle(rank: number) {
  if (rank === 1) return 'bg-amber-500/20 border-amber-500/40 text-amber-400'
  if (rank === 2) return 'bg-slate-400/20 border-slate-400/40 text-slate-300'
  if (rank === 3) return 'bg-orange-700/20 border-orange-700/40 text-orange-400'
  return 'bg-white/5 border-white/10 text-white/40'
}

function getRankEmoji(rank: number) {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `#${rank}`
}

function getELOTier(elo: number): string {
  if (elo >= 1600) return 'Grand Rounds'
  if (elo >= 1400) return 'Attending'
  if (elo >= 1200) return 'Resident'
  if (elo >= 1000) return 'Intern'
  return 'Med Student'
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/medduel/leaderboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <Trophy className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="text-white/40 text-sm mt-1">Top clinicians vs the AI Doctor</p>
      </div>

      {/* AI Doctor baseline */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🤖</span>
          <div>
            <p className="font-semibold">AI Doctor (Claude)</p>
            <p className="text-xs text-white/40">The benchmark to beat</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-blue-400">1350 ELO</p>
          <p className="text-xs text-white/40">Attending</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-white/30">
          <p>No players yet — be the first!</p>
          <Link href="/medduel" className="mt-3 inline-block text-emerald-400 text-sm hover:underline">
            Play today's case
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map(entry => (
            <div
              key={entry.id}
              className={`border rounded-xl p-4 flex items-center gap-4 ${getRankStyle(entry.rank)}`}
            >
              {/* Rank */}
              <div className="w-10 text-center font-bold shrink-0 text-lg">
                {getRankEmoji(entry.rank)}
              </div>

              {/* Name + badges */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{entry.display_name || 'Anonymous'}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs text-white/30">{getELOTier(entry.elo_rating)}</span>
                  {entry.streak_days > 1 && (
                    <span className="text-xs text-orange-400">🔥 {entry.streak_days}</span>
                  )}
                  {(entry.badges ?? []).slice(0, 3).map((b, i) => (
                    <span key={i} className="text-sm">{b.icon}</span>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="text-right shrink-0 space-y-0.5">
                <p className="font-bold text-lg">{entry.elo_rating}</p>
                <p className="text-xs text-white/30">{entry.accuracy_pct}% acc · {entry.total_attempts} cases</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
