"use client";

import { useState } from "react";
import type { PredictionResponse } from "@/types/patient";
import { OUTCOME_LABELS } from "@/types/patient";
import {
  formatPercent,
  getRiskColor,
  getRiskBgColor,
  getConfidenceBadgeColor,
} from "@/lib/utils";
import {
  ArrowLeft,
  AlertTriangle,
  TrendingUp,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Activity,
} from "lucide-react";
import { OrganChart } from "./organ-chart";

interface Props {
  response: PredictionResponse;
  onBack: () => void;
}

export function ResultsDashboard({ response, onBack }: Props) {
  const [showFactors, setShowFactors] = useState(false);

  // Get all unique risk factors from mortality outcomes
  const mortalityOutcomes = response.outcomes.filter((o) =>
    o.outcome_type.startsWith("mortality_")
  );
  const riskFactors = mortalityOutcomes[0]?.risk_factors || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-lg bg-card border border-border hover:bg-card/80 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-bold">Prediction Results</h2>
          <p className="text-sm text-muted">{response.patient_summary}</p>
        </div>
      </div>

      {/* Clinical Scores Used */}
      {Object.keys(response.clinical_scores_used).length > 0 && (
        <div className="flex flex-wrap gap-3">
          {Object.entries(response.clinical_scores_used).map(
            ([name, score]) => (
              <div
                key={name}
                className="px-3 py-2 bg-card border border-border rounded-lg"
              >
                <span className="text-xs text-muted">{name}</span>
                <span className="ml-2 font-mono font-bold text-accent">
                  {score}
                </span>
              </div>
            )
          )}
        </div>
      )}

      {/* Outcome Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {response.outcomes.map((outcome) => (
          <div
            key={outcome.outcome_type}
            className={`rounded-lg border p-4 ${getRiskBgColor(outcome.probability_mid)}`}
          >
            <h3 className="text-sm font-semibold mb-1">
              {OUTCOME_LABELS[outcome.outcome_type]}
            </h3>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-3xl font-mono font-bold ${getRiskColor(outcome.probability_mid)}`}
              >
                {formatPercent(outcome.probability_mid)}
              </span>
            </div>
            <div className="mt-2 text-xs text-muted space-y-1">
              <div className="flex justify-between">
                <span>Range:</span>
                <span className="font-mono">
                  {formatPercent(outcome.probability_low)} –{" "}
                  {formatPercent(outcome.probability_high)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Baseline ({outcome.outcome_type.includes("mortality") ? "cohort" : "population"}):</span>
                <span className="font-mono">
                  {formatPercent(outcome.baseline_probability)}
                </span>
              </div>
              {outcome.probability_mid > outcome.baseline_probability && (
                <div className="flex items-center gap-1 text-warning mt-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>
                    {(
                      (outcome.probability_mid /
                        Math.max(outcome.baseline_probability, 0.001) -
                        1) *
                      100
                    ).toFixed(0)}
                    % above baseline
                  </span>
                </div>
              )}
            </div>
            {/* Risk factor count per outcome */}
            {outcome.risk_factors.length > 0 && (
              <div className="mt-2 text-xs text-muted">
                {outcome.risk_factors.length} risk factor
                {outcome.risk_factors.length !== 1 ? "s" : ""} identified
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Evidence Summary (Narrative) */}
      {response.evidence_narrative && (
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Evidence Summary</h3>
          </div>
          <div className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed">
            {response.evidence_narrative}
          </div>
        </div>
      )}

      {/* Risk Factor Table (Expandable) */}
      {riskFactors.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <button
            onClick={() => setShowFactors(!showFactors)}
            className="w-full px-5 py-3 flex items-center gap-2 text-left hover:bg-card/80"
          >
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">
              Risk Factor Breakdown ({riskFactors.length} factors)
            </span>
            <span className="ml-auto">
              {showFactors ? (
                <ChevronUp className="w-4 h-4 text-muted" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted" />
              )}
            </span>
          </button>
          {showFactors && (
            <div className="px-5 pb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted text-xs">
                      <th className="text-left py-2 pr-4">Factor</th>
                      <th className="text-left py-2 pr-4">Effect</th>
                      <th className="text-left py-2 pr-4">Confidence</th>
                      <th className="text-left py-2">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {riskFactors
                      .sort((a, b) => b.relative_risk - a.relative_risk)
                      .map((factor, i) => (
                        <tr
                          key={i}
                          className="border-b border-border/50 last:border-0"
                        >
                          <td className="py-3 pr-4">
                            <div className="font-medium">
                              {factor.factor_name}
                            </div>
                            <div className="text-xs text-muted mt-0.5">
                              {factor.description}
                            </div>
                          </td>
                          <td className="py-3 pr-4 font-mono whitespace-nowrap">
                            <span
                              className={
                                factor.relative_risk > 1
                                  ? "text-red-400"
                                  : factor.relative_risk < 1
                                    ? "text-green-400"
                                    : "text-muted"
                              }
                            >
                              {factor.relative_risk > 1
                                ? `+${((factor.relative_risk - 1) * 100).toFixed(0)}%`
                                : `${((factor.relative_risk - 1) * 100).toFixed(0)}%`}
                            </span>
                            <span className="text-xs text-muted ml-1">
                              RR {factor.relative_risk.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <span
                              className={`px-2 py-0.5 rounded text-xs border ${getConfidenceBadgeColor(factor.confidence)}`}
                            >
                              {factor.confidence}
                            </span>
                          </td>
                          <td className="py-3 text-xs text-muted max-w-xs">
                            {factor.source}
                            {factor.calculator_name && (
                              <span className="ml-1 text-accent">
                                [{factor.calculator_name}]
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Organ Model Trajectories */}
      {response.organ_models.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">
              Organ Model Projections
            </h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {response.organ_models.map((model, i) => (
              <OrganChart key={i} model={model} />
            ))}
          </div>
        </div>
      )}

      {/* Disclaimers */}
      <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
          <div className="space-y-1">
            {response.disclaimers.map((d, i) => (
              <p key={i} className="text-xs text-muted">
                {d}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
