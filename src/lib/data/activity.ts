import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProfileSummary, ReactionKey, Song } from "@/lib/types";

export type ActivityItem = {
  id: string;
  kind: "like" | "comment" | "follow" | "reaction" | "share" | "favorite";
  actor: ProfileSummary;
  at: string;
  postId?: string;
  song?: Song;
  text?: string;
  emoji?: ReactionKey;
};

/** Explicit FK hints: likes/post_reactions also link posts and profiles, so bare embeds are ambiguous. */
const actor = (table: string) => `actor:profiles!${table}_user_id_fkey(id, username, display_name, avatar_url, is_demo)`;

const postEmbed = (table: string) => `post:music_posts!${table}_post_id_fkey(id, song:songs!music_posts_song_id_fkey(*))`;

type PostRef = { id: string; song: Song } | null;

/** Interactions other people had with the user's posts and profile. */
export async function getNotifications(userId: string, limit = 40): Promise<ActivityItem[]> {
  const supabase = await createClient();
  const { data: myPosts } = await supabase
    .from("music_posts")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  const postIds = (myPosts ?? []).map((p) => p.id);

  const [likes, comments, reactions, follows] = await Promise.all([
    postIds.length
      ? supabase.from("likes").select(`created_at, user_id, ${actor("likes")}, ${postEmbed("likes")}`).in("post_id", postIds).neq("user_id", userId).order("created_at", { ascending: false }).limit(limit)
      : Promise.resolve({ data: [] }),
    postIds.length
      ? supabase.from("comments").select(`id, body, created_at, user_id, ${actor("comments")}, ${postEmbed("comments")}`).in("post_id", postIds).neq("user_id", userId).order("created_at", { ascending: false }).limit(limit)
      : Promise.resolve({ data: [] }),
    postIds.length
      ? supabase.from("post_reactions").select(`emoji, created_at, user_id, ${actor("post_reactions")}, ${postEmbed("post_reactions")}`).in("post_id", postIds).neq("user_id", userId).order("created_at", { ascending: false }).limit(limit)
      : Promise.resolve({ data: [] }),
    supabase
      .from("follows")
      .select("created_at, actor:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url, is_demo)")
      .eq("following_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  type Row = { created_at: string; actor: ProfileSummary; post?: PostRef; body?: string; id?: string; emoji?: ReactionKey };
  const items: ActivityItem[] = [
    ...((likes.data ?? []) as unknown as Row[]).map((r) => ({
      id: `like-${r.actor?.id}-${r.post?.id}`, kind: "like" as const, actor: r.actor, at: r.created_at, postId: r.post?.id, song: r.post?.song,
    })),
    ...((comments.data ?? []) as unknown as Row[]).map((r) => ({
      id: `comment-${r.id}`, kind: "comment" as const, actor: r.actor, at: r.created_at, postId: r.post?.id, song: r.post?.song, text: r.body,
    })),
    ...((reactions.data ?? []) as unknown as Row[]).map((r) => ({
      id: `reaction-${r.actor?.id}-${r.post?.id}-${r.emoji}`, kind: "reaction" as const, actor: r.actor, at: r.created_at, postId: r.post?.id, song: r.post?.song, emoji: r.emoji,
    })),
    ...((follows.data ?? []) as unknown as Row[]).map((r) => ({
      id: `follow-${r.actor?.id}`, kind: "follow" as const, actor: r.actor, at: r.created_at,
    })),
  ];
  return items.filter((i) => i.actor).sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

/** What a set of users has been doing: shares, favorites and likes. */
export async function getUsersActivity(userIds: string[], limit = 30): Promise<ActivityItem[]> {
  if (userIds.length === 0) return [];
  const supabase = await createClient();
  const [posts, favs, likes] = await Promise.all([
    supabase.from("music_posts").select(`id, caption, created_at, ${actor("music_posts")}, song:songs!music_posts_song_id_fkey(*)`).in("user_id", userIds).order("created_at", { ascending: false }).limit(limit),
    supabase.from("favorites").select(`created_at, ${actor("favorites")}, song:songs!favorites_song_id_fkey(*)`).in("user_id", userIds).order("created_at", { ascending: false }).limit(limit),
    supabase.from("likes").select(`created_at, ${actor("likes")}, ${postEmbed("likes")}`).in("user_id", userIds).order("created_at", { ascending: false }).limit(limit),
  ]);

  type Row = { id?: string; caption?: string; created_at: string; actor: ProfileSummary; song?: Song; post?: PostRef };
  const items: ActivityItem[] = [
    ...((posts.data ?? []) as unknown as Row[]).map((r) => ({
      id: `share-${r.id}`, kind: "share" as const, actor: r.actor, at: r.created_at, postId: r.id, song: r.song, text: r.caption,
    })),
    ...((favs.data ?? []) as unknown as Row[]).map((r) => ({
      id: `fav-${r.actor?.id}-${r.song?.id}`, kind: "favorite" as const, actor: r.actor, at: r.created_at, song: r.song,
    })),
    ...((likes.data ?? []) as unknown as Row[]).map((r) => ({
      id: `liked-${r.actor?.id}-${r.post?.id}`, kind: "like" as const, actor: r.actor, at: r.created_at, postId: r.post?.id, song: r.post?.song,
    })),
  ];
  return items.filter((i) => i.actor && i.song).sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

export async function getFollowingActivity(userId: string, limit = 30) {
  const supabase = await createClient();
  const { data } = await supabase.from("follows").select("following_id").eq("follower_id", userId);
  return getUsersActivity((data ?? []).map((f) => f.following_id), limit);
}
