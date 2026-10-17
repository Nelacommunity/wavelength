import { ArrowDownRight, ArrowUpRight, Minus, Sparkles } from "lucide-react";
import type { TrendDirection } from "@/lib/types";
import { cn, formatPct } from "@/lib/utils";

export function TrendIndicator({
  direction,
  changePct,
  className,
  compact,
}: {
  direction: TrendDirection;
  changePct: number | null;
  className?: string;
  compact?: boolean;
}) {
  if (direction === "new") {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs font-semibold text-accent", className)}>
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        New
      </span>
    );
  }
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  const label = direction === "up" ? "Rising" : direction === "down" ? "Falling" : "Steady";
  return (
    <span
      title={`${label} ${formatPct(changePct)} vs previous period`}
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums",
        direction === "up" && "text-up",
        direction === "down" && "text-down",
        direction === "steady" && "text-muted",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-label={label} />
      {compact ? formatPct(changePct).replace(/\.\d%/, "%") : formatPct(changePct)}
    </span>
  );
}
