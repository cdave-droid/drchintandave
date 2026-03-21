'use client'

import { useEffect, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import type { GameCase, DiffOption, DiffChangeEvent } from '@/lib/gameTypes'

// ── Types ─────────────────────────────────────────────────────────────────────

type GamePhase =
  | 'loading'
  | 'error'
  | 'presentation'
  | 'lab_order'
  | 'lab_results'
  | 'narrowing'
  | 'final_dx'
  | 'management'
  | 'clincher'
  | 'results'

interface GameState {
  phase: GamePhase
  gameCase: GameCase | null
  sessionId: string | null
  isDemo: boolean
  startTime: number
  differentials: DiffOption[]
  labsOrdered: string[]
  focusedTestSelected: string | null
  finalDiagnosis: string | null
  managementSelected: string | null
  clincherSelected: string | null
  diffChangelog: DiffChangeEvent[]
  result: any | null
}

const STAGE_LABELS = [
  'Presentation',
  'Order Labs',
  'Lab Results',
  'Update Dx',
  'Final Dx',
  'Management',
  'Clincher',
  'Results',
]

const PHASE_TO_STAGE: Record<GamePhase, number> = {
  loading: 0,
  error: 0,
  presentation: 1,
  lab_order: 2,
  lab_results: 3,
  narrowing: 4,
  final_dx: 5,
  management: 6,
  clincher: 7,
  results: 8,
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StageProgressBar({ phase }: { phase: GamePhase }) {
  const current = PHASE_TO_STAGE[phase]
  if (current === 0) return null
  return (
    <div className="flex items-center gap-1 mb-6">
      {STAGE_LABELS.map((label, i) => {
        const step = i + 1
        const done = step < current
        const active = step === current
        return (
          <div key={step} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                done
                  ? 'bg-emerald-600 text-white'
                  : active
                  ? 'bg-emerald-500 text-white ring-2 ring-emerald-300'
                  : 'bg-gray-200 text-gray-400'
              }`}
            >
              {done ? <CheckCircle2 className="w-4 h-4" /> : step}
            </div>
            <span className={`text-[10px] text-center leading-tight hidden sm:block ${active ? 'text-emerald-700 font-semibold' : done ? 'text-emerald-600' : 'text-gray-400'}`}>
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function Md({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
      }}
    >
      {children}
    </ReactMarkdown>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm p-5 ${className}`}>
      {children}
    </div>
  )
}

function PrimaryBtn({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-5 py-2.5 font-semibold transition-colors"
    >
      {children}
    </button>
  )
}

// ── Differential Panel ────────────────────────────────────────────────────────

interface DifferentialPanelProps {
  gameCase: GameCase
  selected: DiffOption[]
  locked: boolean
  stage: number
  startTime: number
  onChange: (updated: DiffOption[], event: DiffChangeEvent) => void
}

function DifferentialPanel({ gameCase, selected, locked, stage, startTime, onChange }: DifferentialPanelProps) {
  const [customInput, setCustomInput] = useState('')
  const selectedIds = new Set(selected.map(d => d.id))

  function add(opt: DiffOption) {
    if (selected.length >= 3 || selectedIds.has(opt.id)) return
    const evt: DiffChangeEvent = { stage, action: 'add', id: opt.id, label: opt.label, ts: Math.round((Date.now() - startTime) / 1000) }
    onChange([...selected, opt], evt)
  }

  function remove(id: string) {
    const opt = selected.find(d => d.id === id)
    if (!opt) return
    const evt: DiffChangeEvent = { stage, action: 'remove', id: opt.id, label: opt.label, ts: Math.round((Date.now() - startTime) / 1000) }
    onChange(selected.filter(d => d.id !== id), evt)
  }

  function addCustom() {
    const trimmed = customInput.trim()
    if (!trimmed || selected.length >= 3) return
    const id = `custom-${Date.now()}`
    const opt: DiffOption = { id, label: trimmed }
    add(opt)
    setCustomInput('')
  }

  const available = gameCase.differential_options.filter(o => !selectedIds.has(o.id))

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Your Differentials {!locked && <span className="text-gray-400">(select up to 3)</span>}
      </p>

      {/* Slots */}
      <div className="space-y-2">
        {[0, 1, 2].map(i => {
          const d = selected[i]
          return (
            <div
              key={i}
              className={`flex items-center justify-between rounded-lg px-3 py-2 border text-sm ${
                d
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-medium'
                  : 'bg-gray-50 border-dashed border-gray-300 text-gray-400'
              }`}
            >
              <span>{d ? d.label : `Differential ${i + 1}`}</span>
              {d && !locked && (
                <button onClick={() => remove(d.id)} className="ml-2 text-emerald-500 hover:text-red-500 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {!locked && (
        <>
          {/* Preset options */}
          <div className="flex flex-wrap gap-1.5">
            {available.map(opt => (
              <button
                key={opt.id}
                onClick={() => add(opt)}
                disabled={selected.length >= 3}
                className="text-xs border border-gray-300 rounded-full px-2.5 py-1 hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors bg-white"
              >
                <Plus className="w-3 h-3 inline mr-0.5" />
                {opt.label}
              </button>
            ))}
          </div>

          {/* Free-text */}
          <div className="flex gap-2">
            <input
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCustom() }}
              placeholder="Other diagnosis…"
              maxLength={60}
              className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
            />
            <button
              onClick={addCustom}
              disabled={!customInput.trim() || selected.length >= 3}
              className="text-sm bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
            >
              Add
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Stage views ───────────────────────────────────────────────────────────────

function PresentationStage({
  state,
  onDiffChange,
  onNext,
}: {
  state: GameState
  onDiffChange: (diffs: DiffOption[], evt: DiffChangeEvent) => void
  onNext: () => void
}) {
  const gc = state.gameCase!
  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-start justify-between gap-2 mb-3">
          <h2 className="text-lg font-bold text-gray-900">{gc.title}</h2>
          <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 capitalize">
            {gc.difficulty}
          </span>
        </div>
        <div className="text-sm text-gray-700 leading-relaxed">
          <Md>{gc.vignette}</Md>
        </div>
      </Card>

      <Card>
        <DifferentialPanel
          gameCase={gc}
          selected={state.differentials}
          locked={false}
          stage={1}
          startTime={state.startTime}
          onChange={onDiffChange}
        />
      </Card>

      <div className="flex justify-end">
        <PrimaryBtn onClick={onNext} disabled={state.differentials.length === 0}>
          Order Initial Labs →
        </PrimaryBtn>
      </div>
    </div>
  )
}

function LabOrderStage({
  state,
  onDiffChange,
  onLabToggle,
  onNext,
}: {
  state: GameState
  onDiffChange: (diffs: DiffOption[], evt: DiffChangeEvent) => void
  onLabToggle: (id: string) => void
  onNext: () => void
}) {
  const gc = state.gameCase!
  const categories = Array.from(new Set(gc.lab_options.map(l => l.category)))
  const ordered = new Set(state.labsOrdered)
  const count = ordered.size
  const max = gc.max_labs

  // Compact vignette banner
  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800 font-medium">
        📋 {gc.title}
        <span className="ml-2 text-blue-600 font-normal text-xs">— vignette above</span>
      </div>

      <Card>
        <DifferentialPanel
          gameCase={gc}
          selected={state.differentials}
          locked={false}
          stage={2}
          startTime={state.startTime}
          onChange={onDiffChange}
        />
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-700">Select labs to order</p>
          <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${count > max ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {count} / {max} selected
          </span>
        </div>

        <div className="space-y-4">
          {categories.map(cat => (
            <div key={cat}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{cat}</p>
              <div className="space-y-1.5">
                {gc.lab_options.filter(l => l.category === cat).map(lab => {
                  const checked = ordered.has(lab.id)
                  return (
                    <label
                      key={lab.id}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border cursor-pointer transition-colors ${
                        checked
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                          : 'bg-white border-gray-200 hover:border-emerald-300 text-gray-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onLabToggle(lab.id)}
                        className="accent-emerald-600"
                      />
                      <span className="text-sm font-medium">{lab.name}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex justify-end">
        <PrimaryBtn onClick={onNext} disabled={count === 0}>
          Reveal Results →
        </PrimaryBtn>
      </div>
    </div>
  )
}

function LabResultsStage({
  state,
  onFocusedTestSelect,
  onNext,
}: {
  state: GameState
  onFocusedTestSelect: (id: string) => void
  onNext: () => void
}) {
  const gc = state.gameCase!
  const orderedLabs = gc.lab_options.filter(l => state.labsOrdered.includes(l.id))

  function flagBadge(flag: string | null | undefined) {
    if (!flag) return null
    const cls =
      flag === 'CRITICAL'
        ? 'bg-red-100 text-red-700'
        : 'bg-amber-100 text-amber-700'
    return <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${cls}`}>{flag}</span>
  }

  return (
    <div className="space-y-5">
      {/* Lab results table */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Lab Results</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs text-gray-500 text-left">
                <th className="pb-2 font-semibold">Test</th>
                <th className="pb-2 font-semibold">Result</th>
                <th className="pb-2 font-semibold hidden sm:table-cell">Reference Range</th>
                <th className="pb-2 font-semibold">Flag</th>
              </tr>
            </thead>
            <tbody>
              {orderedLabs.map(lab => (
                <tr key={lab.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 font-medium text-gray-800 pr-3 align-top">{lab.name}</td>
                  <td className="py-2 text-gray-700 align-top pr-3">
                    <Md>{lab.result}</Md>
                  </td>
                  <td className="py-2 text-gray-500 text-xs hidden sm:table-cell align-top pr-3">
                    {lab.reference_range || '—'}
                  </td>
                  <td className="py-2 align-top">{flagBadge(lab.flag)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Post-labs narrative */}
      <Card className="bg-blue-50 border-blue-200">
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">Clinical Interpretation</p>
        <div className="text-sm text-blue-900 leading-relaxed">
          <Md>{gc.post_labs_narrative}</Md>
        </div>
      </Card>

      {/* Focused test picker */}
      <Card>
        <p className="text-sm font-semibold text-gray-700 mb-3">
          Order one focused test or consult:
        </p>
        <div className="space-y-2">
          {gc.focused_test_options.map(ft => {
            const selected = state.focusedTestSelected === ft.id
            return (
              <label
                key={ft.id}
                className={`flex items-start gap-3 rounded-lg px-3 py-3 border cursor-pointer transition-colors ${
                  selected
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                    : 'bg-white border-gray-200 hover:border-emerald-300 text-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="focused_test"
                  checked={selected}
                  onChange={() => onFocusedTestSelect(ft.id)}
                  className="mt-0.5 accent-emerald-600"
                />
                <div>
                  <span className="text-sm font-medium">{ft.name}</span>
                  <span className="ml-2 text-xs text-gray-400 capitalize">({ft.type})</span>
                </div>
              </label>
            )
          })}
        </div>
      </Card>

      <div className="flex justify-end">
        <PrimaryBtn onClick={onNext} disabled={!state.focusedTestSelected}>
          Continue →
        </PrimaryBtn>
      </div>
    </div>
  )
}

function NarrowingStage({
  state,
  onDiffChange,
  onNext,
}: {
  state: GameState
  onDiffChange: (diffs: DiffOption[], evt: DiffChangeEvent) => void
  onNext: () => void
}) {
  const gc = state.gameCase!
  const ft = gc.focused_test_options.find(f => f.id === state.focusedTestSelected)

  return (
    <div className="space-y-5">
      {ft && (
        <Card className="bg-purple-50 border-purple-200">
          <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider mb-1">
            {ft.name} — Result
          </p>
          <div className="text-sm text-purple-900 leading-relaxed">
            <Md>{ft.result}</Md>
          </div>
        </Card>
      )}

      <Card>
        <p className="text-sm font-semibold text-gray-700 mb-4">
          Update your differentials based on the evidence:
        </p>
        <DifferentialPanel
          gameCase={gc}
          selected={state.differentials}
          locked={false}
          stage={4}
          startTime={state.startTime}
          onChange={onDiffChange}
        />
      </Card>

      <div className="flex justify-end">
        <PrimaryBtn onClick={onNext} disabled={state.differentials.length === 0}>
          Confirm & Choose Diagnosis →
        </PrimaryBtn>
      </div>
    </div>
  )
}

function FinalDxStage({
  state,
  onSelect,
}: {
  state: GameState
  onSelect: (id: string) => void
}) {
  const gc = state.gameCase!

  return (
    <div className="space-y-5">
      <Card className="bg-gray-50 border-gray-300">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Patient Summary</p>
        <p className="text-sm text-gray-700 font-medium">{gc.title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{gc.specialty} · {gc.difficulty}</p>
      </Card>

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">
          Select your final diagnosis:
        </p>
        <div className="space-y-2">
          {state.differentials.map(d => (
            <button
              key={d.id}
              onClick={() => onSelect(d.id)}
              className="w-full text-left rounded-xl border-2 border-emerald-400 bg-emerald-50 hover:bg-emerald-100 px-4 py-3 font-semibold text-emerald-900 transition-colors"
            >
              {d.label}
            </button>
          ))}
        </div>
        {state.differentials.length === 0 && (
          <p className="text-sm text-gray-400">No differentials selected.</p>
        )}
      </div>
    </div>
  )
}

function ManagementStage({
  state,
  onSelect,
  onNext,
}: {
  state: GameState
  onSelect: (id: string) => void
  onNext: () => void
}) {
  const gc = state.gameCase!
  const diagLabel = gc.differential_options.find(d => d.id === state.finalDiagnosis)?.label ?? state.finalDiagnosis

  return (
    <div className="space-y-5">
      <div className="bg-emerald-50 border border-emerald-300 rounded-xl px-4 py-3 text-sm text-emerald-900 font-semibold">
        ✓ Diagnosis confirmed: {diagLabel}
      </div>

      <Card>
        <div className="text-sm text-gray-800 font-medium mb-4 leading-relaxed">
          <Md>{gc.management_question}</Md>
        </div>
        <div className="space-y-2">
          {gc.management_options.map(opt => {
            const selected = state.managementSelected === opt.id
            return (
              <label
                key={opt.id}
                className={`flex items-start gap-3 rounded-lg px-3 py-3 border cursor-pointer transition-colors ${
                  selected
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                    : 'bg-white border-gray-200 hover:border-emerald-300 text-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="management"
                  checked={selected}
                  onChange={() => onSelect(opt.id)}
                  className="mt-0.5 accent-emerald-600 shrink-0"
                />
                <span className="text-sm">{opt.text}</span>
              </label>
            )
          })}
        </div>
      </Card>

      <div className="flex justify-end">
        <PrimaryBtn onClick={onNext} disabled={!state.managementSelected}>
          Submit →
        </PrimaryBtn>
      </div>
    </div>
  )
}

function ClincherStage({
  state,
  onSelect,
  onSubmit,
  submitting,
}: {
  state: GameState
  onSelect: (id: string) => void
  onSubmit: () => void
  submitting: boolean
}) {
  const gc = state.gameCase!

  return (
    <div className="space-y-5">
      <Card>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Clincher Question</p>
        <div className="text-sm text-gray-800 font-medium mb-4 leading-relaxed">
          <Md>{gc.clincher_question}</Md>
        </div>
        <div className="space-y-2">
          {gc.clincher_options.map(opt => {
            const selected = state.clincherSelected === opt.id
            return (
              <label
                key={opt.id}
                className={`flex items-start gap-3 rounded-lg px-3 py-3 border cursor-pointer transition-colors ${
                  selected
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                    : 'bg-white border-gray-200 hover:border-emerald-300 text-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="clincher"
                  checked={selected}
                  onChange={() => onSelect(opt.id)}
                  className="mt-0.5 accent-emerald-600 shrink-0"
                />
                <span className="text-sm">{opt.text}</span>
              </label>
            )
          })}
        </div>
      </Card>

      <div className="flex justify-end">
        <PrimaryBtn onClick={onSubmit} disabled={!state.clincherSelected || submitting}>
          {submitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Scoring…
            </span>
          ) : (
            'Submit & See Score →'
          )}
        </PrimaryBtn>
      </div>
    </div>
  )
}

function ResultsStage({ state }: { state: GameState }) {
  const gc = state.gameCase!
  const result = state.result
  const [openTp, setOpenTp] = useState(false)

  if (!result) return null

  const score = result.score ?? 0
  const maxScore = result.max_score ?? 760
  const pct = Math.round((score / maxScore) * 100)

  const breakdown = [
    { label: 'Diagnosis', score: result.score_diagnosis, max: gc.scoring.differential_correct_each * 2 + gc.scoring.diagnosis_correct },
    { label: 'Workup', score: result.score_workup, max: gc.scoring.lab_key_correct * 2 + gc.scoring.lab_efficiency_bonus + gc.scoring.focused_test_bonus },
    { label: 'Management', score: result.score_management, max: gc.scoring.management_correct },
    { label: 'Clincher', score: result.score_clincher, max: gc.scoring.clincher_correct },
    { label: 'Speed', score: result.score_speed, max: gc.scoring.speed_max },
  ]

  const correctDx = gc.differential_options.find(d => d.id === gc.correct_diagnosis)
  const userDxLabel = gc.differential_options.find(d => d.id === state.finalDiagnosis)?.label
    ?? state.differentials.find(d => d.id === state.finalDiagnosis)?.label
    ?? state.finalDiagnosis

  const mgmtOpt = gc.management_options.find(m => m.id === state.managementSelected)
  const clinOpt = gc.clincher_options.find(c => c.id === state.clincherSelected)
  const expertDxLabel = gc.differential_options.find(d => d.id === gc.expert_path.final_diagnosis)?.label

  return (
    <div className="space-y-5">
      {state.isDemo && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-2 text-xs text-amber-700 font-medium">
          Playing with a demo case
        </div>
      )}

      {/* Score hero */}
      <Card className="text-center">
        <div className="text-5xl font-extrabold text-emerald-600 mb-1">{score}</div>
        <div className="text-sm text-gray-500 mb-3">out of {maxScore} points</div>
        <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
          <div
            className="bg-emerald-500 h-3 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-xs text-gray-500">{pct}% — better than {result.percentile ?? '—'}% of players</div>
      </Card>

      {/* Score breakdown */}
      <Card>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Score Breakdown</p>
        <div className="space-y-2">
          {breakdown.map(row => (
            <div key={row.label} className="flex items-center gap-3">
              <span className="text-sm text-gray-600 w-24 shrink-0">{row.label}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full"
                  style={{ width: `${Math.round(((row.score ?? 0) / (row.max || 1)) * 100)}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-gray-700 w-16 text-right">
                {row.score ?? 0} / {row.max}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* True diagnosis */}
      <Card className="bg-emerald-50 border-emerald-300">
        <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">True Diagnosis</p>
        <p className="text-lg font-bold text-emerald-900">{correctDx?.label ?? gc.correct_diagnosis}</p>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="text-gray-600">Your answer:</span>
          {userDxLabel === correctDx?.label
            ? <span className="text-emerald-700 font-semibold flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />{userDxLabel}</span>
            : <span className="text-red-600 font-semibold flex items-center gap-1"><XCircle className="w-4 h-4" />{userDxLabel ?? '—'}</span>
          }
        </div>
      </Card>

      {/* Management reveal */}
      <Card>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Management</p>
        <div className={`rounded-lg px-3 py-3 border text-sm ${mgmtOpt?.is_correct ? 'bg-emerald-50 border-emerald-400 text-emerald-800' : 'bg-red-50 border-red-300 text-red-700'}`}>
          <div className="flex items-center gap-2 font-semibold mb-1">
            {mgmtOpt?.is_correct ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {mgmtOpt?.text ?? '—'}
          </div>
          {mgmtOpt?.explanation && (
            <p className="text-xs opacity-80">{mgmtOpt.explanation}</p>
          )}
        </div>
        {!mgmtOpt?.is_correct && (
          <div className="mt-2 rounded-lg px-3 py-3 border bg-emerald-50 border-emerald-300 text-sm text-emerald-800">
            <p className="text-xs font-semibold mb-1">Correct answer:</p>
            <p className="font-semibold">{gc.management_options.find(m => m.is_correct)?.text}</p>
            <p className="text-xs opacity-80 mt-1">{gc.management_options.find(m => m.is_correct)?.explanation}</p>
          </div>
        )}
      </Card>

      {/* Clincher reveal */}
      <Card>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Clincher</p>
        <div className={`rounded-lg px-3 py-3 border text-sm ${clinOpt?.is_correct ? 'bg-emerald-50 border-emerald-400 text-emerald-800' : 'bg-red-50 border-red-300 text-red-700'}`}>
          <div className="flex items-center gap-2 font-semibold">
            {clinOpt?.is_correct ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {clinOpt?.text ?? '—'}
          </div>
        </div>
        <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 text-xs text-gray-700 leading-relaxed">
          <Md>{gc.clincher_explanation}</Md>
        </div>
      </Card>

      {/* Your path vs Expert path */}
      <Card>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Your Path vs Expert Path</p>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-bold text-gray-600 mb-1.5">You</p>
            <div className="space-y-1">
              <p className="text-gray-500 text-xs">Dx: <span className="text-gray-800 font-medium">{userDxLabel ?? '—'}</span></p>
              <p className="text-gray-500 text-xs">Labs: <span className="text-gray-800 font-medium">{state.labsOrdered.length} ordered</span></p>
              <p className="text-gray-500 text-xs">
                Focused: <span className="text-gray-800 font-medium">
                  {gc.focused_test_options.find(f => f.id === state.focusedTestSelected)?.name ?? '—'}
                </span>
              </p>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-700 mb-1.5">Expert</p>
            <div className="space-y-1">
              <p className="text-gray-500 text-xs">Dx: <span className="text-emerald-800 font-medium">{expertDxLabel ?? gc.expert_path.final_diagnosis}</span></p>
              <p className="text-gray-500 text-xs">Labs: <span className="text-emerald-800 font-medium">{gc.expert_path.labs.join(', ')}</span></p>
              <p className="text-gray-500 text-xs">
                Focused: <span className="text-emerald-800 font-medium">
                  {gc.focused_test_options.find(f => f.id === gc.expert_path.focused_tests[0])?.name ?? '—'}
                </span>
              </p>
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600">
          <span className="font-semibold">Expert rationale:</span> {gc.expert_path.rationale}
        </div>
      </Card>

      {/* Teaching points */}
      <Card>
        <button
          className="flex items-center justify-between w-full text-sm font-semibold text-gray-700"
          onClick={() => setOpenTp(p => !p)}
        >
          <span>Teaching Points ({gc.teaching_points.length})</span>
          {openTp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {openTp && (
          <ul className="mt-3 space-y-2">
            {gc.teaching_points.map((tp, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700">
                <span className="text-emerald-500 font-bold shrink-0">•</span>
                <Md>{tp}</Md>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MedDuelGamePage() {
  const [state, setState] = useState<GameState>({
    phase: 'loading',
    gameCase: null,
    sessionId: null,
    isDemo: false,
    startTime: 0,
    differentials: [],
    labsOrdered: [],
    focusedTestSelected: null,
    finalDiagnosis: null,
    managementSelected: null,
    clincherSelected: null,
    diffChangelog: [],
    result: null,
  })
  const [errorMsg, setErrorMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Load case on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/medduel/game?demo=1')
        if (!res.ok) throw new Error('Failed to load case')
        const data = await res.json()
        setState(prev => ({
          ...prev,
          phase: 'presentation',
          gameCase: data.case,
          isDemo: data.demo ?? false,
          startTime: Date.now(),
        }))
      } catch (e: any) {
        setErrorMsg(e.message ?? 'Failed to load')
        setState(prev => ({ ...prev, phase: 'error' }))
      }
    }
    load()
  }, [])

  // Start session
  const startSession = useCallback(async (gc: GameCase, isDemo: boolean) => {
    try {
      const res = await fetch('/api/medduel/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: gc.id, demo: isDemo }),
      })
      const data = await res.json()
      setState(prev => ({ ...prev, sessionId: data.session?.id ?? null }))
    } catch {
      // non-fatal, proceed
    }
  }, [])

  // Submit final score
  const submitResult = useCallback(async (finalState: GameState) => {
    setSubmitting(true)
    try {
      const timeSecs = Math.round((Date.now() - finalState.startTime) / 1000)
      const res = await fetch('/api/medduel/game', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: finalState.sessionId,
          demo: finalState.isDemo,
          completed: true,
          differentials_selected: finalState.differentials.map(d => ({ id: d.id, label: d.label })),
          labs_ordered: finalState.labsOrdered.map(id => ({ id })),
          focused_tests_ordered: finalState.focusedTestSelected ? [{ id: finalState.focusedTestSelected }] : [],
          final_diagnosis: finalState.finalDiagnosis,
          management_selected: finalState.managementSelected,
          clincher_selected: finalState.clincherSelected,
          diff_changelog: finalState.diffChangelog,
          time_taken_seconds: timeSecs,
        }),
      })
      const data = await res.json()
      setState(prev => ({ ...prev, phase: 'results', result: data.session }))
    } catch {
      setErrorMsg('Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [])

  // ── Event handlers ───────────────────────────────────────────────────────

  function handleDiffChange(diffs: DiffOption[], evt: DiffChangeEvent) {
    setState(prev => ({
      ...prev,
      differentials: diffs,
      diffChangelog: [...prev.diffChangelog, evt],
    }))
  }

  function handleLabToggle(id: string) {
    setState(prev => {
      const has = prev.labsOrdered.includes(id)
      return {
        ...prev,
        labsOrdered: has ? prev.labsOrdered.filter(l => l !== id) : [...prev.labsOrdered, id],
      }
    })
  }

  function handleFocusedTestSelect(id: string) {
    setState(prev => ({ ...prev, focusedTestSelected: id }))
  }

  function handleManagementSelect(id: string) {
    setState(prev => ({ ...prev, managementSelected: id }))
  }

  function handleClincherSelect(id: string) {
    setState(prev => ({ ...prev, clincherSelected: id }))
  }

  async function handleFinalDxSelect(id: string) {
    setState(prev => ({ ...prev, finalDiagnosis: id, phase: 'management' }))
  }

  // Phase transitions
  async function handlePresentationNext() {
    if (!state.gameCase) return
    await startSession(state.gameCase, state.isDemo)
    setState(prev => ({ ...prev, phase: 'lab_order' }))
  }

  function handleLabOrderNext() {
    setState(prev => ({ ...prev, phase: 'lab_results' }))
  }

  function handleLabResultsNext() {
    setState(prev => ({ ...prev, phase: 'narrowing' }))
  }

  function handleNarrowingNext() {
    setState(prev => ({ ...prev, phase: 'final_dx' }))
  }

  function handleManagementNext() {
    setState(prev => ({ ...prev, phase: 'clincher' }))
  }

  async function handleClincherSubmit() {
    await submitResult(state)
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (state.phase === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div className="text-center py-24">
        <p className="text-red-500 font-medium">{errorMsg || 'Something went wrong.'}</p>
        <button
          className="mt-4 text-sm text-emerald-600 underline"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto pb-16">
      {/* Header */}
      <div className="text-center py-6 mb-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
          Med<span className="text-emerald-600">Duel</span>
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">Clinical Reasoning Challenge</p>
      </div>

      <StageProgressBar phase={state.phase} />

      {state.phase === 'presentation' && state.gameCase && (
        <PresentationStage
          state={state}
          onDiffChange={handleDiffChange}
          onNext={handlePresentationNext}
        />
      )}

      {state.phase === 'lab_order' && state.gameCase && (
        <LabOrderStage
          state={state}
          onDiffChange={handleDiffChange}
          onLabToggle={handleLabToggle}
          onNext={handleLabOrderNext}
        />
      )}

      {state.phase === 'lab_results' && state.gameCase && (
        <LabResultsStage
          state={state}
          onFocusedTestSelect={handleFocusedTestSelect}
          onNext={handleLabResultsNext}
        />
      )}

      {state.phase === 'narrowing' && state.gameCase && (
        <NarrowingStage
          state={state}
          onDiffChange={handleDiffChange}
          onNext={handleNarrowingNext}
        />
      )}

      {state.phase === 'final_dx' && state.gameCase && (
        <FinalDxStage
          state={state}
          onSelect={handleFinalDxSelect}
        />
      )}

      {state.phase === 'management' && state.gameCase && (
        <ManagementStage
          state={state}
          onSelect={handleManagementSelect}
          onNext={handleManagementNext}
        />
      )}

      {state.phase === 'clincher' && state.gameCase && (
        <ClincherStage
          state={state}
          onSelect={handleClincherSelect}
          onSubmit={handleClincherSubmit}
          submitting={submitting}
        />
      )}

      {state.phase === 'results' && state.gameCase && (
        <ResultsStage state={state} />
      )}
    </div>
  )
}
