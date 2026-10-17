import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Song } from "@/lib/types";

export async function getSong(id: string): Promise<Song | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("songs").select("*").eq("id", id).maybeSingle();
  return (data as Song) ?? null;
}

export async function getSongsByIds(ids: string[]): Promise<Map<string, Song>> {
  if (ids.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase.from("songs").select("*").in("id", ids);
  if (error) throw error;
  return new Map((data as Song[]).map((s) => [s.id, s]));
}

/** Uploaded songs matched by title, artist or album. */
export async function searchLocalSongs(term: string, genre?: string | null, limit = 12): Promise<Song[]> {
  const supabase = await createClient();
  let query = supabase.from("songs").select("*").eq("provider", "upload").limit(limit);
  const safe = term.replace(/[%_,().*\\]/g, " ").trim();
  if (safe) query = query.or(`title.ilike.%${safe}%,artist.ilike.%${safe}%,album.ilike.%${safe}%`);
  if (genre) query = query.eq("genre", genre);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return data as Song[];
}

export async function getFavoriteSongIds(userId: string | undefined, songIds: string[]): Promise<Set<string>> {
  if (!userId || songIds.length === 0) return new Set();
  const supabase = await createClient();
  const { data } = await supabase.from("favorites").select("song_id").eq("user_id", userId).in("song_id", songIds);
  return new Set((data ?? []).map((r: { song_id: string }) => r.song_id));
}
