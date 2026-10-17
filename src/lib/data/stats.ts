import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getAnchorDate, getTrending } from "@/lib/data/trending";
import { getSongsByIds } from "@/lib/data/songs";
import { addDays } from "@/lib/utils";

export type PlatformPoint = {
  date: string;
  total: number;
  active: number;
  newListeners: number;
  shares: number;
  demo: boolean;
};

export async function getPlatformSeries(days = 90) {
  const supabase = await createClient();
  const anchor = await getAnchorDate();
  const start = addDays(anchor, -(days - 1));
  const { data, error } = await supabase
    .from("daily_platform_stats")
    .select("*")
    .gte("stat_date", start)
    .lte("stat_date", anchor)
    .order("stat_date");
  if (error) throw error;

  const byDate = new Map<string, PlatformPoint>();
  for (const r of data as {
    stat_date: string;
    source: "demo" | "live";
    total_listeners: number;
    active_listeners: number;
    new_listeners: number;
    shares: number;
  }[]) {
    const p = byDate.get(r.stat_date) ?? { date: r.stat_date, total: 0, active: 0, newListeners: 0, shares: 0, demo: false };
    p.total += r.total_listeners;
    p.active += r.active_listeners;
    p.newListeners += r.new_listeners;
    p.shares += r.shares;
    if (r.source === "demo") p.demo = true;
    byDate.set(r.stat_date, p);
  }
  return { anchor, points: [...byDate.values()] };
}

export type LiveCounts = { profiles: number; posts: number; likes: number; comments: number; listens: number; listeners: number };

/** Real activity only (demo users excluded). */
export async function getLiveCounts(): Promise<LiveCounts> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("live_platform_counts");
  if (error) throw error;
  const r = (Array.isArray(data) ? data[0] : data) ?? {};
  return {
    profiles: Number(r.profiles ?? 0),
    posts: Number(r.posts ?? 0),
    likes: Number(r.likes ?? 0),
    comments: Number(r.comments ?? 0),
    listens: Number(r.listens ?? 0),
    listeners: Number(r.listeners ?? 0),
  };
}

export async function getCountryStats(days = 7) {
  const supabase = await createClient();
  const anchor = await getAnchorDate();
  const start = addDays(anchor, -(days - 1));
  const [countries, tops] = await Promise.all([
    supabase.rpc("country_window_stats", { p_start: start, p_end: anchor }),
    supabase.rpc("top_song_by_country", { p_start: start, p_end: anchor }),
  ]);
  if (countries.error) throw countries.error;
  if (tops.error) throw tops.error;

  const topRows = tops.data as { country: string; song_id: string; listeners: number }[];
  const songs = await getSongsByIds([...new Set(topRows.map((t) => t.song_id))]);
  const topByCountry = new Map(topRows.map((t) => [t.country, { song: songs.get(t.song_id) ?? null, listeners: Number(t.listeners) }]));

  return (countries.data as { country: string; listeners: number; plays: number; shares: number }[]).map((c) => ({
    country: c.country,
    listeners: Number(c.listeners),
    plays: Number(c.plays),
    shares: Number(c.shares),
    top: topByCountry.get(c.country) ?? null,
  }));
}

export async function getMostListened(days: "week" | "month" = "week", limit = 10) {
  const { entries } = await getTrending(days, null, null, 200);
  return [...entries].sort((a, b) => b.listeners - a.listeners).slice(0, limit);
}
