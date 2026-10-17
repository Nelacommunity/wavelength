"use client";

import { formatNumber } from "@/lib/utils";

type Item = { name?: string | number; value?: number | string; color?: string; dataKey?: string | number };

export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  nameFor,
}: {
  active?: boolean;
  payload?: Item[];
  label?: string | number;
  labelFormatter?: (l: string) => string;
  nameFor?: (key: string) => string;
}) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort((a, b) => Number(b.value) - Number(a.value));
  return (
    <div className="min-w-44 rounded-xl border border-line-strong bg-surface-2/95 px-3 py-2.5 text-xs shadow-xl backdrop-blur">
      <div className="mb-1.5 font-semibold text-fg">{labelFormatter ? labelFormatter(String(label)) : label}</div>
      <ul className="space-y-1">
        {sorted.map((p) => (
          <li key={String(p.dataKey)} className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
            <span className="max-w-40 truncate text-muted">{nameFor ? nameFor(String(p.dataKey)) : p.name}</span>
            <span className="ml-auto pl-3 font-semibold tabular-nums text-fg">{formatNumber(Number(p.value))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const shortDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
