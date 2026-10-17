import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Profile, ProfileSummary, Song } from "@/lib/types";

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
  return (data as Profile) ?? null;
}

export async function getFollowCounts(userId: string, viewerId?: string) {
  const supabase = await createClient();
  const [followers, following, mine] = await Promise.all([
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
    viewerId && viewerId !== userId
      ? supabase.from("follows").select("follower_id").eq("follower_id", viewerId).eq("following_id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    followers: followers.count ?? 0,
    following: following.count ?? 0,
    isFollowing: Boolean(mine.data),
  };
}

export async function getFavorites(userId: string, limit = 24): Promise<Song[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("favorites")
    .select("created_at, song:songs!favorites_song_id_fkey(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as unknown as { song: Song }[]).map((r) => r.song).filter(Boolean);
}

/** Genre mix from a user's favorites and shares (listening history is private). */
export async function getTopGenres(userId: string) {
  const supabase = await createClient();
  const [{ data: favs }, { data: posts }] = await Promise.all([
    supabase.from("favorites").select("song:songs!favorites_song_id_fkey(genre)").eq("user_id", userId).limit(200),
    supabase.from("music_posts").select("song:songs!music_posts_song_id_fkey(genre)").eq("user_id", userId).limit(200),
  ]);
  const counts = new Map<string, number>();
  for (const r of [...(favs ?? []), ...(posts ?? [])] as unknown as { song: { genre: string | null } | null }[]) {
    const g = r.song?.genre;
    if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  return [...counts.entries()]
    .map(([genre, count]) => ({ genre, count, share: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

/** People the viewer doesn't follow yet, most active sharers first. */
export async function getSuggestedUsers(viewerId?: string, limit = 5): Promise<(ProfileSummary & { bio: string | null; posts: number })[]> {
  const supabase = await createClient();
  let exclude: string[] = [];
  if (viewerId) {
    const { data } = await supabase.from("follows").select("following_id").eq("follower_id", viewerId);
    exclude = [viewerId, ...(data ?? []).map((f) => f.following_id)];
  }
  let query = supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, is_demo, bio, music_posts!music_posts_user_id_fkey(count)")
    .limit(40);
  if (exclude.length) query = query.not("id", "in", `(${exclude.join(",")})`);
  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as (ProfileSummary & { bio: string | null; music_posts: { count: number }[] })[])
    .map(({ music_posts, ...p }) => ({ ...p, posts: music_posts?.[0]?.count ?? 0 }))
    .sort((a, b) => b.posts - a.posts)
    .slice(0, limit);
}

export async function getFollowList(userId: string, kind: "followers" | "following"): Promise<ProfileSummary[]> {
  const supabase = await createClient();
  const select =
    kind === "followers"
      ? "p:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url, is_demo)"
      : "p:profiles!follows_following_id_fkey(id, username, display_name, avatar_url, is_demo)";
  const { data, error } = await supabase
    .from("follows")
    .select(select)
    .eq(kind === "followers" ? "following_id" : "follower_id", userId)
    .limit(100);
  if (error) throw error;
  return (data as unknown as { p: ProfileSummary }[]).map((r) => r.p).filter(Boolean);
}
