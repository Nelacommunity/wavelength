"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompact } from "@/lib/utils";
import { AXIS, GRID, SERIES } from "@/components/charts/palette";
import { ChartTooltip, shortDate } from "@/components/charts/chart-tooltip";

export type ChartSeries = { key: string; label: string };

/** Daily listeners for the current top songs. */
export function TrendChart({ data, series, height = 260 }: { data: Record<string, string | number>[]; series: ChartSeries[]; height?: number }) {
  const labels = Object.fromEntries(series.map((s) => [s.key, s.label]));
  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted" aria-label="Legend">
        {series.map((s, i) => (
          <li key={s.key} className="flex min-w-0 items-center gap-1.5">
            <span className="h-[3px] w-3.5 shrink-0 rounded-full" style={{ background: SERIES[i % SERIES.length] }} aria-hidden />
            <span className="max-w-[12rem] truncate">{s.label}</span>
          </li>
        ))}
      </ul>
      <div style={{ height }} role="img" aria-label={`Daily listeners for ${series.map((s) => s.label).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} stroke={AXIS} tickLine={false} axisLine={false} fontSize={11} minTickGap={24} />
            <YAxis tickFormatter={(v) => formatCompact(v)} stroke={AXIS} tickLine={false} axisLine={false} fontSize={11} width={48} />
            <Tooltip
              cursor={{ stroke: "#3a3a44", strokeWidth: 1 }}
              content={<ChartTooltip labelFormatter={shortDate} nameFor={(k) => labels[k] ?? k} />}
            />
            {series.map((s, i) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={SERIES[i % SERIES.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "#121215" }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
