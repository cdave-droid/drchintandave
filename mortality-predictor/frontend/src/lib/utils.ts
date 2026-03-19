import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function getRiskColor(probability: number): string {
  if (probability >= 0.5) return "text-red-400";
  if (probability >= 0.25) return "text-orange-400";
  if (probability >= 0.10) return "text-yellow-400";
  return "text-green-400";
}

export function getRiskBgColor(probability: number): string {
  if (probability >= 0.5) return "bg-red-500/20 border-red-500/30";
  if (probability >= 0.25) return "bg-orange-500/20 border-orange-500/30";
  if (probability >= 0.10) return "bg-yellow-500/20 border-yellow-500/30";
  return "bg-green-500/20 border-green-500/30";
}

export function getConfidenceBadgeColor(confidence: string): string {
  switch (confidence) {
    case "high":
      return "bg-green-500/20 text-green-400 border-green-500/30";
    case "moderate":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "low":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    default:
      return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
  }
}

/** Remove undefined/null values from an object (for clean API payloads) */
export function cleanPayload<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null && value !== "") {
      if (typeof value === "object" && !Array.isArray(value)) {
        const cleaned = cleanPayload(value as Record<string, unknown>);
        if (Object.keys(cleaned).length > 0) {
          result[key] = cleaned;
        }
      } else {
        result[key] = value;
      }
    }
  }
  return result as Partial<T>;
}
