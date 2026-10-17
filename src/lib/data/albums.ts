import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Album, ProfileSummary, Song } from "@/lib/types";

const ARTIST = "artist:profiles!albums_user_id_fkey(id, username, display_name, avatar_url, is_demo)";

export type AlbumWithTracks = Album & { artist: ProfileSummary; tracks: Song[] };

export async function getAlbum(id: string): Promise<AlbumWithTracks | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("albums").select(`*, ${ARTIST}`).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: tracks, error: tErr } = await supabase
    .from("songs")
    .select("*")
    .eq("album_id", id)
    .order("track_number", { ascending: true });
  if (tErr) throw tErr;
  return { ...(data as unknown as Album & { artist: ProfileSummary }), tracks: tracks as Song[] };
}

/** A user's uploads: albums (with track counts) and standalone singles. */
export async function getUserMusic(userId: string) {
  const supabase = await createClient();
  const [albums, singles] = await Promise.all([
    supabase
      .from("albums")
      .select("*, songs!songs_album_id_fkey(count)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("songs")
      .select("*")
      .eq("uploaded_by", userId)
      .is("album_id", null)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (albums.error) throw albums.error;
  if (singles.error) throw singles.error;
  return {
    albums: (albums.data as unknown as (Album & { songs: { count: number }[] })[]).map(({ songs, ...a }) => ({
      ...a,
      trackCount: songs?.[0]?.count ?? 0,
    })),
    singles: singles.data as Song[],
  };
}

export async function getUploader(userId: string): Promise<ProfileSummary | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, is_demo")
    .eq("id", userId)
    .maybeSingle();
  return (data as ProfileSummary) ?? null;
}
