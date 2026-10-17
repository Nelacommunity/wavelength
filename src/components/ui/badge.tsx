import { FlaskConical, Radio } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border border-line-strong px-2 py-0.5 text-[11px] font-medium text-muted", className)}>
      {children}
    </span>
  );
}

/** Marks simulated numbers so they are never mistaken for real data. */
export function DemoBadge({ className, label = "Demo data" }: { className?: string; label?: string }) {
  return (
    <span
      title="Simulated numbers from seed data — not real listener statistics"
      className={cn("inline-flex items-center gap-1 rounded-full border border-warn/40 bg-warn/10 px-2 py-0.5 text-[11px] font-medium text-warn", className)}
    >
      <FlaskConical className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

export function LiveBadge({ className }: { className?: string }) {
  return (
    <span
      title="Computed from verified listening events on Wavelength"
      className={cn("inline-flex items-center gap-1 rounded-full border border-up/40 bg-up/10 px-2 py-0.5 text-[11px] font-medium text-up", className)}
    >
      <Radio className="h-3 w-3" aria-hidden />
      Live data
    </span>
  );
}

export function DataSourceBadges({ demo, live }: { demo: boolean; live: boolean }) {
  return (
    <span className="inline-flex gap-1.5">
      {demo && <DemoBadge />}
      {live && <LiveBadge />}
    </span>
  );
}
