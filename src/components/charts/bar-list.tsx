import type { ReactNode } from "react";
import { formatCompact, formatNumber } from "@/lib/utils";

/** Ranked horizontal bars in plain HTML — readable without hover. */
export function BarList({ items }: { items: { key: string; label: ReactNode; value: number; extra?: ReactNode }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.key} title={formatNumber(i.value)}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{i.label}</span>
            <span className="flex shrink-0 items-center gap-2 tabular-nums text-muted">
              {i.extra}
              <span className="font-semibold text-fg">{formatCompact(i.value)}</span>
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-accent" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
