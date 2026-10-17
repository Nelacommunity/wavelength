import "server-only";
import { createClient } from "@/lib/supabase/server";
import { REACTIONS } from "@/lib/constants";
import type { Comment, FeedPost, ProfileSummary, ReactionKey, Song } from "@/lib/types";

const POST_BASE =
  "id, caption, created_at, user:profiles!music_posts_user_id_fkey(id, username, display_name, avatar_url, is_demo), song:songs!music_posts_song_id_fkey(*), likes(count), comments(count)";
const ALBUM_EMBED = "album:albums!music_posts_album_id_fkey(id, title, cover_url, genre, songs!songs_album_id_fkey(count))";

// Album posts need the 20261019 migration; until it's applied, fall back to
// song-only posts instead of breaking the feed.
let albumPostsReady = false;
async function postSelect() {
  if (albumPostsReady) return `${POST_BASE}, ${ALBUM_EMBED}`;
  const supabase = await createClient();
  const { error } = await supabase.from("music_posts").select("album_id").limit(1);
  albumPostsReady = !error;
  return albumPostsReady ? `${POST_BASE}, ${ALBUM_EMBED}` : POST_BASE;
}

type RawPost = {
  id: string;
  caption: string;
  created_at: string;
  user: ProfileSummary;
  song: Song;
  album?: { id: string; title: string; cover_url: string | null; genre: string | null; songs: { count: number }[] } | null;
  likes: { count: number }[];
  comments: { count: number }[];
};

async function hydrate(rows: RawPost[], viewerId?: string): Promise<FeedPost[]> {
  if (rows.length === 0) return [];
  const supabase = await createClient();
  const ids = rows.map((r) => r.id);

  const [{ data: reactions }, { data: myLikes }] = await Promise.all([
    supabase.from("post_reactions").select("post_id, emoji, user_id").in("post_id", ids),
    viewerId
      ? supabase.from("likes").select("post_id").eq("user_id", viewerId).in("post_id", ids)
      : Promise.resolve({ data: [] as { post_id: string }[] }),
  ]);

  const liked = new Set((myLikes ?? []).map((l) => l.post_id));
  const reactionMap = new Map<string, Map<ReactionKey, { count: number; mine: boolean }>>();
  for (const r of (reactions ?? []) as { post_id: string; emoji: ReactionKey; user_id: string }[]) {
    const m = reactionMap.get(r.post_id) ?? new Map();
    const cur = m.get(r.emoji) ?? { count: 0, mine: false };
    cur.count += 1;
    if (r.user_id === viewerId) cur.mine = true;
    m.set(r.emoji, cur);
    reactionMap.set(r.post_id, m);
  }

  return rows
    .filter((r) => r.user && r.song)
    .map((r) => {
      const m = reactionMap.get(r.id);
      return {
        id: r.id,
        caption: r.caption,
        created_at: r.created_at,
        user: r.user,
        song: r.song,
        album: r.album
          ? { id: r.album.id, title: r.album.title, cover_url: r.album.cover_url, genre: r.album.genre, track_count: r.album.songs?.[0]?.count ?? 0 }
          : null,
        like_count: r.likes?.[0]?.count ?? 0,
        comment_count: r.comments?.[0]?.count ?? 0,
        liked_by_me: liked.has(r.id),
        reactions: REACTIONS.map(({ key }) => ({ emoji: key, count: m?.get(key)?.count ?? 0, mine: m?.get(key)?.mine ?? false })),
      };
    });
}

export async function getFeed({
  viewerId,
  scope = "all",
  limit = 20,
}: {
  viewerId?: string;
  scope?: "all" | "following";
  limit?: number;
}): Promise<FeedPost[]> {
  const supabase = await createClient();
  let query = supabase.from("music_posts").select(await postSelect()).order("created_at", { ascending: false }).limit(limit);

  if (scope === "following") {
    if (!viewerId) return [];
    const { data: follows } = await supabase.from("follows").select("following_id").eq("follower_id", viewerId);
    const ids = (follows ?? []).map((f) => f.following_id);
    if (ids.length === 0) return [];
    query = query.in("user_id", ids);
  }

  const { data, error } = await query;
  if (error) throw error;
  return hydrate(data as unknown as RawPost[], viewerId);
}

export async function getPostsByUser(userId: string, viewerId?: string, limit = 20) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("music_posts")
    .select(await postSelect())
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return hydrate(data as unknown as RawPost[], viewerId);
}

export async function getPostsForSong(songId: string, viewerId?: string, limit = 10) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("music_posts")
    .select(await postSelect())
    .eq("song_id", songId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return hydrate(data as unknown as RawPost[], viewerId);
}

export async function getPost(id: string, viewerId?: string): Promise<FeedPost | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("music_posts").select(await postSelect()).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [post] = await hydrate([data as unknown as RawPost], viewerId);
  return post ?? null;
}

export async function getComments(postId: string): Promise<Comment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .select("id, body, created_at, user:profiles!comments_user_id_fkey(id, username, display_name, avatar_url, is_demo)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return data as unknown as Comment[];
}

/** Distinct songs from the most recent posts. */
export async function getRecentlySharedSongs(limit = 8) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("music_posts")
    .select("created_at, song:songs!music_posts_song_id_fkey(*), user:profiles!music_posts_user_id_fkey(username, display_name)")
    .order("created_at", { ascending: false })
    .limit(limit * 4);
  if (error) throw error;
  const seen = new Set<string>();
  const out: { song: Song; sharedBy: string; at: string }[] = [];
  for (const r of data as unknown as { created_at: string; song: Song; user: { username: string; display_name: string | null } }[]) {
    if (!r.song || seen.has(r.song.id)) continue;
    seen.add(r.song.id);
    out.push({ song: r.song, sharedBy: r.user?.display_name || r.user?.username, at: r.created_at });
    if (out.length >= limit) break;
  }
  return out;
}
