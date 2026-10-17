import type { Period, ReactionKey } from "@/lib/types";

export const APP_NAME = "Wavelength";

export const GENRES = [
  "Pop", "Hip-Hop", "R&B", "Electronic", "Rock", "Indie", "Latin", "Afrobeats", "K-Pop", "Jazz",
] as const;

export const COUNTRIES: Record<string, string> = {
  US: "United States", GB: "United Kingdom", BR: "Brazil", DE: "Germany", NG: "Nigeria",
  IN: "India", JP: "Japan", KR: "South Korea", MX: "Mexico", FR: "France",
};

export const PERIODS: { value: Period; label: string; days: number }[] = [
  { value: "day", label: "Today", days: 1 },
  { value: "week", label: "This week", days: 7 },
  { value: "month", label: "This month", days: 30 },
];

export const REACTIONS: { key: ReactionKey; emoji: string; label: string }[] = [
  { key: "fire", emoji: "🔥", label: "Fire" },
  { key: "heart", emoji: "💜", label: "Love" },
  { key: "headphones", emoji: "🎧", label: "On repeat" },
  { key: "dance", emoji: "🕺", label: "Dance" },
  { key: "chills", emoji: "🥶", label: "Chills" },
];

export const PROVIDER_LABEL: Record<string, string> = { itunes: "Apple Music" };

export function flag(code: string) {
  if (!/^[A-Z]{2}$/.test(code) || code === "ZZ") return "🌐";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
