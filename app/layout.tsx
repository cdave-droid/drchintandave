import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MedDuel — Clinical Reasoning Game',
  description: 'Test your clinical reasoning against AI. Work through real cases: differentials, labs, and diagnosis.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
