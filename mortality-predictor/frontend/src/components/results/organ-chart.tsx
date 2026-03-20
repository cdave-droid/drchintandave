"use client";

import type { OrganModelOutput } from "@/types/patient";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface Props {
  model: OrganModelOutput;
}

const ORGAN_COLORS: Record<string, string> = {
  renal: "#f59e0b",
  cardiac: "#ef4444",
  hepatic: "#22c55e",
};

function SeverityBadge({ score }: { score: number }) {
  let color: string;
  let label: string;
  if (score >= 0.7) {
    color = "bg-red-500/20 text-red-400 border-red-500/30";
    label = "Severe";
  } else if (score >= 0.4) {
    color = "bg-orange-500/20 text-orange-400 border-orange-500/30";
    label = "Moderate";
  } else if (score >= 0.15) {
    color = "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    label = "Mild";
  } else {
    color = "bg-green-500/20 text-green-400 border-green-500/30";
    label = "Normal";
  }
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${color}`}>
      {label}
    </span>
  );
}

function TrendArrow({ trend }: { trend: string }) {
  if (trend === "worsening") {
    return <span className="text-red-400 text-xs" title="Worsening">&#9650;</span>;
  }
  if (trend === "improving") {
    return <span className="text-green-400 text-xs" title="Improving">&#9660;</span>;
  }
  return <span className="text-zinc-400 text-xs" title="Stable">&#9654;</span>;
}

export function OrganChart({ model }: Props) {
  const color = ORGAN_COLORS[model.organ_system] || "#6366f1";

  const data = model.trajectory_hours.map((h, i) => ({
    hour: Math.round(h),
    value: parseFloat(model.trajectory_values[i].toFixed(2)),
  }));

  // Sample every Nth point to avoid overcrowded charts
  const step = Math.max(1, Math.floor(data.length / 50));
  const sampled = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  const initialValue = sampled[0]?.value || 0;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-sm capitalize">
            {model.organ_system} — {model.parameter_name}
          </h4>
          {model.trend && <TrendArrow trend={model.trend} />}
          {model.severity_score != null && (
            <SeverityBadge score={model.severity_score} />
          )}
        </div>
        <span className="text-xs text-muted">{model.parameter_unit}</span>
      </div>
      <p className="text-xs text-muted mb-1">{model.summary}</p>
      {model.coupling_effects && model.coupling_effects.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {model.coupling_effects.map((effect) => (
            <span
              key={effect}
              className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/25"
            >
              {effect}
            </span>
          ))}
        </div>
      )}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sampled}>
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 10, fill: "#71717a" }}
              label={{
                value: "Hours",
                position: "insideBottom",
                offset: -5,
                fontSize: 10,
                fill: "#71717a",
              }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#71717a" }}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#18181b",
                border: "1px solid #27272a",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelFormatter={(v) => `Hour ${v}`}
              formatter={(v) => [
                `${v} ${model.parameter_unit}`,
                model.parameter_name,
              ]}
            />
            <ReferenceLine
              y={initialValue}
              stroke="#71717a"
              strokeDasharray="3 3"
              label={{
                value: "Initial",
                position: "insideTopRight",
                fontSize: 10,
                fill: "#71717a",
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
