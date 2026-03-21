'use client'

import { useState } from 'react'
import { Plus, CheckCircle2, AlertCircle } from 'lucide-react'

const SPECIALTIES = [
  'Cardiology', 'Neurology', 'Gastroenterology', 'Pulmonology', 'Nephrology',
  'Infectious Disease', 'Endocrinology', 'Rheumatology', 'Oncology', 'Hematology',
  'Emergency Medicine', 'Internal Medicine', 'Dermatology', 'Psychiatry',
  'Orthopedics', 'Pediatrics', 'OB/GYN', 'Ophthalmology', 'ENT', 'Other',
]

type Status = 'idle' | 'submitting' | 'success' | 'error'

export default function SubmitCasePage() {
  const [form, setForm] = useState({
    title: '',
    rawContent: '',
    specialty: '',
    sourceUrl: '',
    submitterName: '',
    submitterEmail: '',
    notes: '',
  })
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('submitting')

    const res = await fetch('/api/medduel/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await res.json()
    if (res.ok) {
      setStatus('success')
      setMessage(data.message)
      setForm({ title: '', rawContent: '', specialty: '', sourceUrl: '', submitterName: '', submitterEmail: '', notes: '' })
    } else {
      setStatus('error')
      setMessage(data.error ?? 'Submission failed.')
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <Plus className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
        <h1 className="text-2xl font-bold">Submit a Case</h1>
        <p className="text-white/40 text-sm mt-1">
          Share an interesting medical case. Our team will review it and add questions before it goes live.
        </p>
      </div>

      {status === 'success' ? (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-8 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <p className="font-semibold text-emerald-300">{message}</p>
          <p className="text-white/40 text-sm mt-2">We&apos;ll review it and add it to the rotation if approved.</p>
          <button
            onClick={() => setStatus('idle')}
            className="mt-4 px-4 py-2 text-sm bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
          >
            Submit another
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm text-white/60 mb-1.5">
              Case Title <span className="text-red-400">*</span>
            </label>
            <input
              required
              value={form.title}
              onChange={e => update('title', e.target.value)}
              placeholder="e.g. 42-year-old male with chest pain and shortness of breath"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Case content */}
          <div>
            <label className="block text-sm text-white/60 mb-1.5">
              Case Description <span className="text-red-400">*</span>
              <span className="ml-2 text-white/30 font-normal">
                (include history, symptoms, relevant labs/imaging if available)
              </span>
            </label>
            <textarea
              required
              value={form.rawContent}
              onChange={e => update('rawContent', e.target.value)}
              placeholder="Describe the case in detail. You can paste from Reddit, a forum post, or write your own..."
              rows={8}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm resize-y focus:outline-none focus:border-emerald-500/50"
            />
            <p className="text-xs text-white/30 mt-1">{form.rawContent.length} chars (min 100)</p>
          </div>

          {/* Specialty + Source URL */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Specialty</label>
              <select
                value={form.specialty}
                onChange={e => update('specialty', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 appearance-none"
              >
                <option value="">Select specialty...</option>
                {SPECIALTIES.map(s => (
                  <option key={s} value={s.toLowerCase()}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Source URL (optional)</label>
              <input
                type="url"
                value={form.sourceUrl}
                onChange={e => update('sourceUrl', e.target.value)}
                placeholder="https://..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          {/* Optional submitter info */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Your Name (optional)</label>
              <input
                value={form.submitterName}
                onChange={e => update('submitterName', e.target.value)}
                placeholder="For attribution"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Email (optional)</label>
              <input
                type="email"
                value={form.submitterEmail}
                onChange={e => update('submitterEmail', e.target.value)}
                placeholder="For updates on your submission"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          {/* Notes for reviewer */}
          <div>
            <label className="block text-sm text-white/60 mb-1.5">Notes for reviewer (optional)</label>
            <textarea
              value={form.notes}
              onChange={e => update('notes', e.target.value)}
              placeholder="Anything you want the admin to know about this case..."
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm resize-none focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {status === 'error' && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'submitting'}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-emerald-500 hover:bg-emerald-400 text-black transition-colors disabled:opacity-50"
          >
            {status === 'submitting' ? 'Submitting...' : 'Submit for Review'}
          </button>

          <p className="text-xs text-white/30 text-center">
            All submissions are reviewed by our team. Medical accuracy and educational value are required.
            Do not submit personally identifiable patient information.
          </p>
        </form>
      )}
    </div>
  )
}
