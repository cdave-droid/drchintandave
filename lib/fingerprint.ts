'use client'

/**
 * Generates a persistent browser fingerprint using available browser signals.
 * Stored in localStorage for consistency.
 */
export function getFingerprint(): string {
  if (typeof window === 'undefined') return 'server'

  const stored = localStorage.getItem('medduel_fp')
  if (stored) return stored

  const raw = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency ?? 0,
  ].join('|')

  const hash = simpleHash(raw + Math.random().toString(36).slice(2))
  localStorage.setItem('medduel_fp', hash)
  return hash
}

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}
