'use client'

import { ExternalLink, Stethoscope } from 'lucide-react'
import type { Case, StructuredVignette } from '@/lib/supabase'
import { DifficultyBadge } from './DifficultyBadge'

function VignetteBlock({ v }: { v: StructuredVignette }) {
  return (
    <div className="grid gap-3 text-sm">
      {v.patient && (
        <div className="flex gap-2">
          <span className="text-white/40 w-28 shrink-0">Patient</span>
          <span>{v.patient}</span>
        </div>
      )}
      {v.chief_complaint && (
        <div className="flex gap-2">
          <span className="text-white/40 w-28 shrink-0">Chief Complaint</span>
          <span>{v.chief_complaint}</span>
        </div>
      )}
      {v.history && (
        <div className="flex gap-2">
          <span className="text-white/40 w-28 shrink-0">History</span>
          <span className="whitespace-pre-line">{v.history}</span>
        </div>
      )}
      {v.vitals && (
        <div className="flex gap-2">
          <span className="text-white/40 w-28 shrink-0">Vitals</span>
          <span>{v.vitals}</span>
        </div>
      )}
      {v.physical_exam && (
        <div className="flex gap-2">
          <span className="text-white/40 w-28 shrink-0">Physical Exam</span>
          <span>{v.physical_exam}</span>
        </div>
      )}
      {v.labs_imaging && (
        <div className="flex gap-2">
          <span className="text-white/40 w-28 shrink-0">Labs / Imaging</span>
          <span>{v.labs_imaging}</span>
        </div>
      )}
    </div>
  )
}

export function CaseCard({ caseData }: { caseData: Case }) {
  const vignette = caseData.structured_vignette

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-white/5 px-6 py-4 border-b border-white/10 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <Stethoscope className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h2 className="font-semibold text-white leading-snug">{caseData.title}</h2>
            <div className="flex items-center gap-2 mt-1.5">
              <DifficultyBadge difficulty={caseData.difficulty} />
              {caseData.specialty && (
                <span className="text-xs text-white/40 capitalize">{caseData.specialty}</span>
              )}
              <span className="text-xs text-white/30 capitalize">from {caseData.source}</span>
            </div>
          </div>
        </div>
        {caseData.source_url && (
          <a
            href={caseData.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-white/30 hover:text-white/70 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>

      {/* Case content */}
      <div className="px-6 py-5">
        {vignette ? (
          <VignetteBlock v={vignette} />
        ) : (
          <p className="text-sm leading-relaxed text-white/80 whitespace-pre-line">
            {caseData.raw_content}
          </p>
        )}
      </div>
    </div>
  )
}
