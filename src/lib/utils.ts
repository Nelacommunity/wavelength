import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en");

export function formatCompact(n: number) {
  return compact.format(n);
}

export function formatNumber(n: number) {
  return full.format(n);
}

export function formatPct(n: number | null) {
  if (n === null || !Number.isFinite(n)) return "—";
  const v = Math.round(n * 1000) / 10;
  return `${v > 0 ? "+" : ""}${v}%`;
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}m`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h`;
  const d = h / 24;
  if (d < 7) return `${Math.floor(d)}d`;
  return new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric" });
}

/** iTunes artwork URLs encode their size; request the size we render. */
export function artworkAt(url: string | null | undefined, size: number) {
  if (!url) return null;
  return url.replace(/\/\d+x\d+bb\./, `/${size}x${size}bb.`);
}

export function displayName(p: { display_name: string | null; username: string }) {
  return p.display_name || p.username;
}

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}
