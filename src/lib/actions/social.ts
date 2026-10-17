"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/auth";
import { cleanText, REACTION_KEYS, uuid } from "@/lib/validation";
import { friendlyError, type ActionResult } from "@/lib/actions/result";
import type { Comment, ReactionKey } from "@/lib/types";

async function authed() {
  const user = await getCurrentUser();
  return user;
}

export async function setLike(postId: string, liked: boolean): Promise<ActionResult> {
  const user = await authed();
  if (!user) return { ok: false, error: "Log in to like posts." };
  if (!uuid.safeParse(postId).success) return { ok: false, error: "Invalid post." };
  const supabase = await createClient();
  const { error } = liked
    ? await supabase.from("likes").upsert({ user_id: user.id, post_id: postId }, { onConflict: "user_id,post_id", ignoreDuplicates: true })
    : await supabase.from("likes").delete().eq("user_id", user.id).eq("post_id", postId);
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true };
}

export async function setReaction(postId: string, emoji: ReactionKey, on: boolean): Promise<ActionResult> {
  const user = await authed();
  if (!user) return { ok: false, error: "Log in to react." };
  if (!uuid.safeParse(postId).success || !REACTION_KEYS.includes(emoji)) return { ok: false, error: "Invalid reaction." };
  const supabase = await createClient();
  const { error } = on
    ? await supabase.from("post_reactions").upsert({ user_id: user.id, post_id: postId, emoji }, { onConflict: "user_id,post_id,emoji", ignoreDuplicates: true })
    : await supabase.from("post_reactions").delete().eq("user_id", user.id).eq("post_id", postId).eq("emoji", emoji);
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true };
}

export async function addComment(postId: string, body: string): Promise<ActionResult<Comment>> {
  const user = await authed();
  if (!user) return { ok: false, error: "Log in to comment." };
  if (!uuid.safeParse(postId).success) return { ok: false, error: "Invalid post." };
  const text = cleanText(body, 500);
  if (!text) return { ok: false, error: "Write something first." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .insert({ user_id: user.id, post_id: postId, body: text })
    .select("id, body, created_at, user:profiles!comments_user_id_fkey(id, username, display_name, avatar_url, is_demo)")
    .single();
  if (error) return { ok: false, error: friendlyError(error, "Could not post your comment.") };
  revalidatePath(`/post/${postId}`);
  return { ok: true, data: data as unknown as Comment };
}

export async function deleteComment(commentId: string): Promise<ActionResult> {
  const user = await authed();
  if (!user) return { ok: false, error: "Log in first." };
  if (!uuid.safeParse(commentId).success) return { ok: false, error: "Invalid comment." };
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("comments")
    .delete({ count: "exact" })
    .eq("id", commentId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: friendlyError(error) };
  if (!count) return { ok: false, error: "You can only delete your own comments." };
  return { ok: true };
}

export async function setFollow(targetId: string, follow: boolean): Promise<ActionResult> {
  const user = await authed();
  if (!user) return { ok: false, error: "Log in to follow people." };
  if (!uuid.safeParse(targetId).success || targetId === user.id) return { ok: false, error: "Invalid user." };
  const supabase = await createClient();
  const { error } = follow
    ? await supabase.from("follows").upsert({ follower_id: user.id, following_id: targetId }, { onConflict: "follower_id,following_id", ignoreDuplicates: true })
    : await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetId);
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true };
}
