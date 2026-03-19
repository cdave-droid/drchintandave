"use client";

import { useState } from "react";
import { PatientForm } from "@/components/clinical/forms/patient-form";
import { ResultsDashboard } from "@/components/clinical/results/results-dashboard";
import { submitPrediction } from "@/lib/clinical/utils";
import type { PredictionRequest, PredictionResponse } from "@/lib/clinical/types";
import { Activity, AlertTriangle, ArrowLeft } from "lucide-react";
import "./mortpred.css";

export default function MortalityPredictorPage() {
  const [results, setResults] = useState<PredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(request: PredictionRequest) {
    setLoading(true);
    setError(null);
    try {
      const response = await submitPrediction(request);
      setResults(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prediction failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mortpred-dark min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--mp-border)] bg-[var(--mp-bg-card)]/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <a
            href="/"
            className="p-2 rounded-lg border border-[var(--mp-border)] hover:opacity-80 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </a>
          <Activity className="w-6 h-6 text-[var(--mp-primary)]" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">MortPred</h1>
            <p className="text-xs text-[var(--mp-muted)]">
              Evidence-Based Clinical Mortality & Outcome Prediction
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-[var(--mp-muted)]">
            <AlertTriangle className="w-3.5 h-3.5 text-[var(--mp-warning)]" />
            Clinical Decision Support Only
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {!results ? (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-2">Patient Assessment</h2>
              <p className="text-[var(--mp-muted)] text-sm">
                Enter patient data below. Only demographics and diagnosis are
                required — additional data improves prediction accuracy.
              </p>
            </div>
            <PatientForm onSubmit={handleSubmit} loading={loading} />
            {error && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}
          </>
        ) : (
          <ResultsDashboard
            response={results}
            onBack={() => setResults(null)}
          />
        )}
      </div>
    </div>
  );
}
