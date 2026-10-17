import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSongsByIds } from "@/lib/data/songs";
import { scoreTrending } from "@/lib/trending";
import { PERIODS } from "@/lib/constants";
import { addDays } from "@/lib/utils";
import type { Period, TrendingEntry } from "@/lib/types";

type WindowRow = {
  song_id: string;
  listeners: number;
  plays: number;
  likes: number;
  shares: number;
  prev_listeners: number;
  recent_listeners: number;
  demo_rows: number;
  live_rows: number;
};

export const getAnchorDate = cache(async (): Promise<string> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("stats_anchor_date");
  if (error) throw error;
  return data as string;
});

export function periodWindow(anchor: string, period: Period) {
  const days = PERIODS.find((p) => p.value === period)?.days ?? 7;
  return { start: addDays(anchor, -(days - 1)), end: anchor, days };
}

export type TrendingResult = {
  entries: TrendingEntry[];
  anchor: string;
  start: string;
  end: string;
  hasDemo: boolean;
  hasLive: boolean;
};

export const getTrending = cache(
  async (period: Period = "week", country: string | null = null, genre: string | null = null, limit = 50): Promise<TrendingResult> => {
    const supabase = await createClient();
    const anchor = await getAnchorDate();
    const { start, end } = periodWindow(anchor, period);

    const { data, error } = await supabase.rpc("song_window_stats", {
      p_start: start,
      p_end: end,
      p_country: country,
      p_genre: genre,
    });
    if (error) throw error;

    const rows = ((data ?? []) as WindowRow[]).map((r) => ({
      id: r.song_id,
      listeners: Number(r.listeners),
      plays: Number(r.plays),
      likes: Number(r.likes),
      shares: Number(r.shares),
      prevListeners: Number(r.prev_listeners),
      recentListeners: Number(r.recent_listeners),
      demo: Number(r.demo_rows) > 0,
      live: Number(r.live_rows) > 0,
    }));
    const active = rows.filter((r) => r.listeners > 0 || r.shares > 0 || r.likes > 0);
    const scored = scoreTrending(active).slice(0, limit);
    const songs = await getSongsByIds(scored.map((s) => s.id));
    const byId = new Map(active.map((r) => [r.id, r]));

    const entries: TrendingEntry[] = [];
    for (const s of scored) {
      const song = songs.get(s.id);
      const r = byId.get(s.id)!;
      // Wavelength charts only rank music uploaded by its artists.
      if (!song || song.provider !== "upload") continue;
      entries.push({
        rank: entries.length + 1,
        song,
        listeners: r.listeners,
        plays: r.plays,
        likes: r.likes,
        shares: r.shares,
        prevListeners: r.prevListeners,
        changePct: s.changePct,
        direction: s.direction,
        score: s.score,
        isDemo: r.demo,
      });
    }

    return {
      entries,
      anchor,
      start,
      end,
      hasDemo: rows.some((r) => r.demo),
      hasLive: rows.some((r) => r.live),
    };
  },
);

export type SeriesPoint = { date: string } & Record<string, number | string>;

/** Daily listeners for several songs, pivoted for charting (one key per song id). */
export async function getSongSeries(songIds: string[], days: number, country: string | null = null): Promise<SeriesPoint[]> {
  if (songIds.length === 0) return [];
  const supabase = await createClient();
  const anchor = await getAnchorDate();
  const start = addDays(anchor, -(days - 1));
  const { data, error } = await supabase.rpc("song_daily_series", {
    p_song_ids: songIds,
    p_start: start,
    p_end: anchor,
    p_country: country,
  });
  if (error) throw error;

  const byDate = new Map<string, SeriesPoint>();
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    byDate.set(date, Object.fromEntries([["date", date], ...songIds.map((id) => [id, 0])]) as SeriesPoint);
  }
  for (const r of (data ?? []) as { song_id: string; stat_date: string; listeners: number }[]) {
    const point = byDate.get(r.stat_date);
    if (point) point[r.song_id] = Number(r.listeners);
  }
  return [...byDate.values()];
}

export type ArtistStat = { artist: string; listeners: number; songs: number; artwork_url: string | null; changePct: number | null };

export async function getTopArtists(period: Period = "week", limit = 8): Promise<ArtistStat[]> {
  const { entries } = await getTrending(period, null, null, 200);
  const map = new Map<string, ArtistStat & { prev: number }>();
  for (const e of entries) {
    const key = e.song.artist;
    const cur = map.get(key) ?? { artist: key, listeners: 0, songs: 0, artwork_url: e.song.artwork_url, changePct: null, prev: 0 };
    cur.listeners += e.listeners;
    cur.prev += e.prevListeners;
    cur.songs += 1;
    map.set(key, cur);
  }
  return [...map.values()]
    .map(({ prev, ...a }) => ({ ...a, changePct: prev > 0 ? (a.listeners - prev) / prev : null }))
    .sort((a, b) => b.listeners - a.listeners)
    .slice(0, limit);
}

/** Popularity (global weekly trending score) for one song, if it has data. */
export async function getSongPopularity(songId: string) {
  const { entries } = await getTrending("week", null, null, 1000);
  return entries.find((e) => e.song.id === songId) ?? null;
}
