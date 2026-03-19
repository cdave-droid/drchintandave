"use client";

import { useState } from "react";
import { PatientForm } from "@/components/forms/patient-form";
import { ResultsDashboard } from "@/components/results/results-dashboard";
import { submitPrediction } from "@/lib/api";
import type { PredictionRequest, PredictionResponse } from "@/types/patient";
import { Activity, AlertTriangle } from "lucide-react";

export default function Home() {
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
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <Activity className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">MortPred</h1>
            <p className="text-xs text-muted">
              Evidence-Based Clinical Mortality & Outcome Prediction
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted">
            <AlertTriangle className="w-3.5 h-3.5 text-warning" />
            Clinical Decision Support — Not for Sole Diagnostic Use
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {!results ? (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-2">Patient Assessment</h2>
              <p className="text-muted text-sm">
                Enter patient data below. Only demographics and diagnosis are
                required — additional data improves prediction accuracy.
              </p>
            </div>
            <PatientForm onSubmit={handleSubmit} loading={loading} />
            {error && (
              <div className="mt-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
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
    </main>
  );
}
