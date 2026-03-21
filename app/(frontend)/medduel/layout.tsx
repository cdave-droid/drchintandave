import type { Metadata } from 'next'
import Link from 'next/link'
import { Stethoscope, Trophy, ShieldCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'MedDuel — Clinical Reasoning Game',
  description:
    'Test your clinical reasoning. Work through real cases: differentials, labs, focused tests, and final diagnosis. Verified clinicians compete on the leaderboard.',
}

export default function MedDuelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Nav */}
      <nav className="border-b border-gray-200 bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/medduel" className="flex items-center gap-2 font-bold text-lg">
            <Stethoscope className="w-5 h-5 text-emerald-600" />
            <span className="text-gray-900">Med</span>
            <span className="text-emerald-600">Duel</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/medduel/leaderboard"
              className="px-3 py-1.5 text-sm rounded-md hover:bg-gray-100 transition-colors flex items-center gap-1.5 text-gray-600"
            >
              <Trophy className="w-3.5 h-3.5" /> Leaderboard
            </Link>
            <Link
              href="/medduel/admin"
              className="px-3 py-1.5 text-sm rounded-md hover:bg-gray-100 transition-colors flex items-center gap-1.5 text-amber-600"
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Admin
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>

      <footer className="border-t border-gray-200 mt-16 py-6 text-center text-xs text-gray-400">
        MedDuel — For educational purposes only. Not a substitute for professional medical advice.
      </footer>
    </div>
  )
}
