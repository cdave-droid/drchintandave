'use client'

import { useState, useEffect } from 'react'
import { ShieldCheck, CheckCircle2, XCircle, Loader2, ExternalLink, RefreshCw } from 'lucide-react'

const SPECIALTIES = [
  'cardiology', 'neurology', 'gastroenterology', 'pulmonology', 'nephrology',
  'infectious disease', 'endocrinology', 'rheumatology', 'oncology', 'hematology',
  'emergency medicine', 'internal medicine', 'dermatology', 'psychiatry',
  'orthopedics', 'pediatrics', 'ob/gyn', 'other',
]

type Submission = {
  id: string
  title: string
  raw_content: string
  specialty: string | null
  source_url: string | null
  submitter_name: string | null
  notes: string | null
  created_at: string
}

export default function AdminPage() {
  const [secret, setSecret] = useState('')
  const [authed, setAuthed] = useState(false)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)
  const [difficulty, setDifficulty] = useState<Record<string, string>>({})
  const [specialty, setSpecialty] = useState<Record<string, string>>({})
  const [scrapeLoading, setScrapeLoading] = useState(false)
  const [scrapeResult, setScrapeResult] = useState<any>(null)

  async function load(s: string) {
    setLoading(true)
    const res = await fetch('/api/medduel/admin?type=submissions', {
      headers: { 'x-admin-secret': s },
    })
    if (res.ok) {
      const data = await res.json()
      setSubmissions(data)
      setAuthed(true)
    } else {
      alert('Invalid secret')
    }
    setLoading(false)
  }

  async function approve(id: string) {
    setProcessing(id)
    const res = await fetch('/api/medduel/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify({
        submissionId: id,
        difficulty: difficulty[id] ?? 'medium',
        specialty: specialty[id] ?? null,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setSubmissions(s => s.filter(x => x.id !== id))
      alert(`Approved! Case ID: ${data.caseId}`)
    } else {
      alert(`Error: ${data.error}`)
    }
    setProcessing(null)
  }

  async function reject(id: string) {
    const reason = prompt('Rejection reason (optional):') ?? ''
    setProcessing(id)
    await fetch('/api/medduel/admin', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify({ submissionId: id, reason }),
    })
    setSubmissions(s => s.filter(x => x.id !== id))
    setProcessing(null)
  }

  async function triggerScrape() {
    setScrapeLoading(true)
    const res = await fetch('/api/medduel/scrape', {
      method: 'POST',
      headers: { 'x-admin-secret': secret },
    })
    const data = await res.json()
    setScrapeResult(data)
    setScrapeLoading(false)
    load(secret)
  }

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto mt-20 space-y-4">
        <div className="text-center">
          <ShieldCheck className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <h1 className="text-xl font-bold">Admin Access</h1>
        </div>
        <input
          type="password"
          placeholder="Admin secret..."
          value={secret}
          onChange={e => setSecret(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') load(secret) }}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/50"
        />
        <button
          onClick={() => load(secret)}
          className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-colors"
        >
          Enter
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" /> Admin Queue
          </h1>
          <p className="text-white/40 text-sm mt-0.5">{submissions.length} pending submissions</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => load(secret)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={triggerScrape}
            disabled={scrapeLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-50"
          >
            {scrapeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '🔍'}
            Scrape Reddit
          </button>
        </div>
      </div>

      {scrapeResult && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3 text-sm text-blue-300">
          Scrape complete — Imported: {scrapeResult.imported}, Skipped: {scrapeResult.skipped}, Errors: {scrapeResult.errors}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
        </div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-12 text-white/30">
          <p>No pending submissions</p>
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map(sub => (
            <div key={sub.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10 flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold">{sub.title}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                    {sub.submitter_name && <span>by {sub.submitter_name}</span>}
                    <span>{new Date(sub.created_at).toLocaleDateString()}</span>
                    {sub.source_url && (
                      <a href={sub.source_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-white/70">
                        <ExternalLink className="w-3 h-3" /> Source
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-5 py-4">
                <p className="text-sm text-white/70 whitespace-pre-line line-clamp-6">
                  {sub.raw_content}
                </p>
                {sub.notes && (
                  <p className="mt-2 text-xs text-white/40 italic">Note: {sub.notes}</p>
                )}
              </div>

              {/* Approval controls */}
              <div className="px-5 py-4 bg-white/3 border-t border-white/10 flex flex-wrap items-center gap-3">
                <select
                  value={difficulty[sub.id] ?? 'medium'}
                  onChange={e => setDifficulty(d => ({ ...d, [sub.id]: e.target.value }))}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                >
                  {['easy', 'medium', 'hard', 'expert'].map(d => (
                    <option key={d} value={d} className="bg-slate-800">{d}</option>
                  ))}
                </select>
                <select
                  value={specialty[sub.id] ?? (sub.specialty ?? '')}
                  onChange={e => setSpecialty(s => ({ ...s, [sub.id]: e.target.value }))}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                >
                  <option value="">Specialty...</option>
                  {SPECIALTIES.map(s => (
                    <option key={s} value={s} className="bg-slate-800">{s}</option>
                  ))}
                </select>

                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={() => reject(sub.id)}
                    disabled={processing === sub.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                  <button
                    onClick={() => approve(sub.id)}
                    disabled={processing === sub.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                  >
                    {processing === sub.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Approve & Generate Questions
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
