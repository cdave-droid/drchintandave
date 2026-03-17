'use client'

import type { Badge } from '@/lib/supabase'

export function BadgeDisplay({ badges, newBadges = [] }: { badges: Badge[]; newBadges?: Badge[] }) {
  if (!badges.length && !newBadges.length) {
    return <p className="text-white/30 text-sm">No badges yet — keep playing!</p>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {newBadges.map(b => (
        <div
          key={b.id}
          className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/40 rounded-full px-3 py-1 text-sm animate-pulse"
          title={b.description}
        >
          <span>{b.icon}</span>
          <span className="text-amber-300 font-medium">{b.name}</span>
          <span className="text-amber-400 text-xs">NEW</span>
        </div>
      ))}
      {badges
        .filter(b => !newBadges.find(n => n.id === b.id))
        .map(b => (
          <div
            key={b.id}
            className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1 text-sm"
            title={`${b.description} — earned ${new Date(b.earned_at).toLocaleDateString()}`}
          >
            <span>{b.icon}</span>
            <span className="text-white/70">{b.name}</span>
          </div>
        ))}
    </div>
  )
}
