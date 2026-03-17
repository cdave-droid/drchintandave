'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'

function getELOTier(elo: number) {
  if (elo >= 1600) return { label: 'Grand Rounds', color: 'text-yellow-400' }
  if (elo >= 1400) return { label: 'Attending', color: 'text-purple-400' }
  if (elo >= 1200) return { label: 'Resident', color: 'text-blue-400' }
  if (elo >= 1000) return { label: 'Intern', color: 'text-emerald-400' }
  return { label: 'Med Student', color: 'text-white/60' }
}

export function ELODisplay({
  elo,
  change,
}: {
  elo: number
  change?: number
}) {
  const tier = getELOTier(elo)
  return (
    <div className="flex items-center gap-2">
      <div>
        <span className={`font-bold text-lg ${tier.color}`}>{elo}</span>
        <span className="text-xs text-white/40 ml-1">ELO</span>
      </div>
      <span className={`text-xs font-medium ${tier.color}`}>{tier.label}</span>
      {change !== undefined && change !== 0 && (
        <span className={`text-xs flex items-center gap-0.5 ${change > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {change > 0 ? '+' : ''}{change}
        </span>
      )}
    </div>
  )
}
