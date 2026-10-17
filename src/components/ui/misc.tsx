import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeader({
  title,
  subtitle,
  href,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  href?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
      {href && !action && (
        <Link href={href} className="shrink-0 text-sm font-semibold text-muted transition-colors hover:text-fg">
          Show all
        </Link>
      )}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-line bg-surface", className)}>{children}</div>;
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center", className)}>
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="font-semibold">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-md bg-surface-2", className)}>
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.04] to-transparent [animation:shimmer_1.6s_infinite]" />
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  badge,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  badge?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm text-muted">
          {Icon && <Icon className="h-4 w-4" aria-hidden />}
          {label}
        </span>
        {badge}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
}

/** Link-based segmented control (keeps filters in the URL). */
export function Segmented({
  items,
  className,
}: {
  items: { href: string; label: string; active: boolean }[];
  className?: string;
}) {
  return (
    <div className={cn("scrollbar-none inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface-2 p-1", className)}>
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          scroll={false}
          aria-current={i.active ? "page" : undefined}
          className={cn(
            "whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
            i.active ? "bg-fg text-black" : "text-muted hover:text-fg",
          )}
        >
          {i.label}
        </Link>
      ))}
    </div>
  );
}

export function Chip({ href, active, children }: { href: string; active?: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active ? "border-accent bg-accent-soft text-accent" : "border-line-strong text-muted hover:border-fg/50 hover:text-fg",
      )}
    >
      {children}
    </Link>
  );
}
