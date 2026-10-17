import type { TrendDirection } from "@/lib/types";

/**
 * Trending score
 * ---------------
 * score = 100 × Σ weight_i × normalized_i
 *
 * Every signal is normalized to 0–1 across the candidate set so songs are
 * compared fairly regardless of absolute scale:
 *  - listeners, plays, shares, likes: log-scaled against the set maximum
 *    (log keeps one mega-hit from flattening everyone else)
 *  - growth: % change in listeners vs the previous equal-length window,
 *    clamped to [-100%, +200%] then mapped to 0–1
 *  - recency: share of the window's listeners that happened in its most
 *    recent third, relative to an even spread (1/3), clamped to 0–1
 *
 * Weights are configurable and are re-normalized to sum to 1.
 */
export type TrendingWeights = {
  listeners: number;
  plays: number;
  growth: number;
  shares: number;
  likes: number;
  recency: number;
};

export const DEFAULT_WEIGHTS: TrendingWeights = {
  listeners: 0.32,
  plays: 0.13,
  growth: 0.22,
  shares: 0.13,
  likes: 0.1,
  recency: 0.1,
};

export type TrendingInput = {
  id: string;
  listeners: number;
  plays: number;
  likes: number;
  shares: number;
  prevListeners: number;
  recentListeners: number;
};

export type TrendingResult = {
  id: string;
  score: number;
  changePct: number | null;
  direction: TrendDirection;
};

const STEADY_BAND = 0.02;

export function changePct(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? null : 0;
  return (current - previous) / previous;
}

export function direction(current: number, previous: number): TrendDirection {
  if (previous <= 0) return current > 0 ? "new" : "steady";
  const pct = (current - previous) / previous;
  if (pct > STEADY_BAND) return "up";
  if (pct < -STEADY_BAND) return "down";
  return "steady";
}

export function scoreTrending(rows: TrendingInput[], weights: TrendingWeights = DEFAULT_WEIGHTS): TrendingResult[] {
  if (rows.length === 0) return [];
  const total = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const w = Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, v / total])) as TrendingWeights;

  const logMax = (key: keyof TrendingInput) => Math.log1p(Math.max(0, ...rows.map((r) => Number(r[key]))));
  const max = {
    listeners: logMax("listeners"),
    plays: logMax("plays"),
    likes: logMax("likes"),
    shares: logMax("shares"),
  };
  const norm = (v: number, m: number) => (m > 0 ? Math.log1p(Math.max(0, v)) / m : 0);

  return rows
    .map((r) => {
      const pct = changePct(r.listeners, r.prevListeners);
      // New entries (no previous data) get the maximum growth signal.
      const growth = pct === null ? 1 : (Math.min(2, Math.max(-1, pct)) + 1) / 3;
      const recency = r.listeners > 0 ? Math.min(1, r.recentListeners / r.listeners / (2 / 3)) : 0;

      const score =
        w.listeners * norm(r.listeners, max.listeners) +
        w.plays * norm(r.plays, max.plays) +
        w.likes * norm(r.likes, max.likes) +
        w.shares * norm(r.shares, max.shares) +
        w.growth * growth +
        w.recency * recency;

      return {
        id: r.id,
        score: Math.round(score * 1000) / 10,
        changePct: pct,
        direction: direction(r.listeners, r.prevListeners),
      };
    })
    .sort((a, b) => b.score - a.score);
}
