import type { Metadata } from 'next'
import Link from 'next/link'
import { Stethoscope, Trophy, Plus, ShieldCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'MedDuel — Beat the AI Doctor',
  description:
    'Test your clinical reasoning against an AI doctor. One case per day. Track your ELO, earn badges, climb the leaderboard.',
}

export default function MedDuelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      {/* Nav */}
      <nav className="border-b border-white/10 backdrop-blur-md bg-[#0a0f1e]/80 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/medduel" className="flex items-center gap-2 font-bold text-lg">
            <Stethoscope className="w-5 h-5 text-emerald-400" />
            <span className="text-white">Med</span>
            <span className="text-emerald-400">Duel</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/medduel"
              className="px-3 py-1.5 text-sm rounded-md hover:bg-white/10 transition-colors"
            >
              Daily Case
            </Link>
            <Link
              href="/medduel/leaderboard"
              className="px-3 py-1.5 text-sm rounded-md hover:bg-white/10 transition-colors flex items-center gap-1.5"
            >
              <Trophy className="w-3.5 h-3.5" /> Board
            </Link>
            <Link
              href="/medduel/submit"
              className="px-3 py-1.5 text-sm rounded-md hover:bg-white/10 transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Submit
            </Link>
            <Link
              href="/medduel/admin"
              className="px-3 py-1.5 text-sm rounded-md hover:bg-white/10 transition-colors flex items-center gap-1.5 text-amber-400"
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Admin
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>

      <footer className="border-t border-white/10 mt-16 py-6 text-center text-xs text-white/30">
        MedDuel — For educational purposes only. Not a substitute for professional medical advice.
      </footer>
    </div>
  )
}
