const COLORS: Record<string, string> = {
  easy: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  hard: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  expert: 'bg-red-500/20 text-red-400 border border-red-500/30',
}

export function DifficultyBadge({ difficulty }: { difficulty: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${COLORS[difficulty] ?? COLORS.medium}`}>
      {difficulty}
    </span>
  )
}
