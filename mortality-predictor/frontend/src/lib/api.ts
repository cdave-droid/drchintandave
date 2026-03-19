import type { PredictionRequest, PredictionResponse } from "@/types/patient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export async function submitPrediction(
  request: PredictionRequest
): Promise<PredictionResponse> {
  const res = await fetch(`${API_BASE}/api/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }

  return res.json();
}
