import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Album, ProfileSummary, Song } from "@/lib/types";

const PROFILE = "id, username, display_name, avatar_url, is_demo";

export type AlbumCard = Album & { artist: ProfileSummary | null; trackCount: number };
export type ArtistCard = ProfileSummary & { songs: number; albums: number };

type RawAlbum = Album & { artist: ProfileSummary | null; songs: { count: number }[] };

const ALBUM_SELECT = `*, artist:profiles!albums_user_id_fkey(${PROFILE}), songs!songs_album_id_fkey(count)`;

const toAlbumCard = ({ songs, ...a }: RawAlbum): AlbumCard => ({ ...a, trackCount: songs?.[0]?.count ?? 0 });

/** Wavelength only serves uploads: strip characters that would break PostgREST filters. */
function safeTerm(term: string) {
  return term.replace(/[%_,().*\\]/g, " ").trim();
}

export async function getNewAlbums({ genre = null, limit = 12 }: { genre?: string | null; limit?: number } = {}): Promise<AlbumCard[]> {
  const supabase = await createClient();
  let q = supabase.from("albums").select(ALBUM_SELECT).order("created_at", { ascending: false }).limit(limit);
  if (genre) q = q.eq("genre", genre);
  const { data, error } = await q;
  if (error) throw error;
  return (data as unknown as RawAlbum[]).map(toAlbumCard).filter((a) => a.trackCount > 0);
}

export async function getLatestUploads({ genre = null, limit = 20 }: { genre?: string | null; limit?: number } = {}): Promise<Song[]> {
  const supabase = await createClient();
  let q = supabase.from("songs").select("*").eq("provider", "upload").order("created_at", { ascending: false }).limit(limit);
  if (genre) q = q.eq("genre", genre);
  const { data, error } = await q;
  if (error) throw error;
  return data as Song[];
}

/** People who have uploaded music, most recent uploaders first. */
export async function getUploadArtists({ genre = null, limit = 12 }: { genre?: string | null; limit?: number } = {}): Promise<ArtistCard[]> {
  const supabase = await createClient();
  let q = supabase.from("songs").select("uploaded_by, album_id").eq("provider", "upload").order("created_at", { ascending: false }).limit(1000);
  if (genre) q = q.eq("genre", genre);
  const { data: rows, error } = await q;
  if (error) throw error;

  const stats = new Map<string, { songs: number; albums: Set<string> }>();
  for (const r of rows as { uploaded_by: string; album_id: string | null }[]) {
    const s = stats.get(r.uploaded_by) ?? { songs: 0, albums: new Set<string>() };
    s.songs += 1;
    if (r.album_id) s.albums.add(r.album_id);
    stats.set(r.uploaded_by, s);
  }
  const ids = [...stats.keys()].slice(0, limit);
  if (ids.length === 0) return [];
  const { data: profiles, error: pErr } = await supabase.from("profiles").select(PROFILE).in("id", ids);
  if (pErr) throw pErr;
  const byId = new Map((profiles as ProfileSummary[]).map((p) => [p.id, p]));
  return ids.flatMap((id) => {
    const p = byId.get(id);
    const s = stats.get(id)!;
    return p ? [{ ...p, songs: s.songs, albums: s.albums.size }] : [];
  });
}

export async function searchAlbums(term: string, limit = 20): Promise<AlbumCard[]> {
  const safe = safeTerm(term);
  if (!safe) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("albums")
    .select(ALBUM_SELECT)
    .or(`title.ilike.%${safe}%,description.ilike.%${safe}%`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as unknown as RawAlbum[]).map(toAlbumCard);
}

export async function searchArtists(term: string, limit = 20): Promise<ArtistCard[]> {
  const safe = safeTerm(term);
  if (!safe) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(`${PROFILE}, songs!songs_uploaded_by_fkey(count), albums!albums_user_id_fkey(count)`)
    .or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`)
    .limit(limit);
  if (error) throw error;
  return (data as unknown as (ProfileSummary & { songs: { count: number }[]; albums: { count: number }[] })[]).map(({ songs, albums, ...p }) => ({
    ...p,
    songs: songs?.[0]?.count ?? 0,
    albums: albums?.[0]?.count ?? 0,
  }));
}
