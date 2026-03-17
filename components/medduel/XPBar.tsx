'use client'

import { getLevelInfo, LEVELS } from '@/lib/gamification'

export function XPBar({ xp, level }: { xp: number; level: number }) {
  const levelInfo = getLevelInfo(xp)
  const next = LEVELS.find(l => l.level === levelInfo.level + 1)
  const pct = next
    ? Math.min(100, ((xp - levelInfo.minXP) / (next.minXP - levelInfo.minXP)) * 100)
    : 100

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs text-white/60">
        <span className="font-semibold text-emerald-400">{levelInfo.title}</span>
        {next && <span>{xp} / {next.minXP} XP</span>}
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
