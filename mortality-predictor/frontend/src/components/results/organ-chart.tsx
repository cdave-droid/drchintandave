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
        <h4 className="font-semibold text-sm capitalize">
          {model.organ_system} — {model.parameter_name}
        </h4>
        <span className="text-xs text-muted">{model.parameter_unit}</span>
      </div>
      <p className="text-xs text-muted mb-3">{model.summary}</p>
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
