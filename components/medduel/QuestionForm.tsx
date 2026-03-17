'use client'

import { useState } from 'react'
import type { Question } from '@/lib/supabase'

interface Props {
  questions: Question[]
  onSubmit: (answers: Record<string, string>) => void
  disabled?: boolean
}

export function QuestionForm({ questions, onSubmit, disabled }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const allAnswered = questions.every(q => answers[q.id]?.trim())

  function handleMCQ(qId: string, label: string) {
    setAnswers(a => ({ ...a, [qId]: label }))
  }

  function handleOpen(qId: string, value: string) {
    setAnswers(a => ({ ...a, [qId]: value }))
  }

  return (
    <div className="space-y-6">
      {questions.map((q, i) => (
        <div key={q.id} className="bg-white/5 border border-white/10 rounded-xl p-5">
          <p className="font-medium text-white mb-4">
            <span className="text-emerald-400 mr-2">Q{i + 1}.</span>
            {q.question_text}
          </p>

          {q.type === 'mcq' && q.options ? (
            <div className="space-y-2">
              {q.options.map(opt => {
                const selected = answers[q.id] === opt.label
                return (
                  <button
                    key={opt.label}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleMCQ(q.id, opt.label)}
                    className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                      selected
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-white/5 border-white/10 hover:border-white/30 hover:bg-white/10'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span className="font-semibold mr-2">{opt.label}.</span>
                    {opt.text}
                  </button>
                )
              })}
            </div>
          ) : (
            <textarea
              disabled={disabled}
              value={answers[q.id] ?? ''}
              onChange={e => handleOpen(q.id, e.target.value)}
              placeholder="Type your clinical answer here..."
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm resize-none focus:outline-none focus:border-emerald-500/50 transition-colors disabled:opacity-50"
            />
          )}
        </div>
      ))}

      <button
        type="button"
        disabled={disabled || !allAnswered}
        onClick={() => onSubmit(answers)}
        className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all
          bg-emerald-500 hover:bg-emerald-400 text-black
          disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white"
      >
        {disabled ? 'Submitted' : allAnswered ? 'Submit & See AI Answer' : 'Answer all questions to submit'}
      </button>
    </div>
  )
}
