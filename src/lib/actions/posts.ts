"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/auth";
import { cleanText, uuid } from "@/lib/validation";
import { friendlyError, type ActionResult } from "@/lib/actions/result";

export type PostState = { error?: string } | undefined;

export async function createPost(_prev: PostState, formData: FormData): Promise<PostState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Log in to share music." };

  const caption = cleanText(formData.get("caption"), 500);
  const songIdRaw = String(formData.get("songId") ?? "");
  const albumIdRaw = String(formData.get("albumId") ?? "");
  const supabase = await createClient();

  let songId: string;
  let albumId: string | null = null;
  if (albumIdRaw) {
    // Album share: anchor the post on the album's first playable track.
    if (!uuid.safeParse(albumIdRaw).success) return { error: "Invalid album." };
    const { data: first } = await supabase
      .from("songs")
      .select("id")
      .eq("album_id", albumIdRaw)
      .order("track_number", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!first) return { error: "This album has no tracks to share yet." };
    songId = first.id;
    albumId = albumIdRaw;
  } else if (songIdRaw && uuid.safeParse(songIdRaw).success) {
    songId = songIdRaw;
  } else {
    return { error: "Pick a song to share." };
  }

  const { data, error } = await supabase
    .from("music_posts")
    .insert({ user_id: user.id, song_id: songId, caption, ...(albumId ? { album_id: albumId } : {}) })
    .select("id")
    .single();
  if (error) return { error: friendlyError(error, "Could not publish your post.") };

  revalidatePath("/");
  redirect(`/post/${data.id}?shared=1`);
}

export async function deletePost(postId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Log in first." };
  if (!uuid.safeParse(postId).success) return { ok: false, error: "Invalid post." };

  const supabase = await createClient();
  // RLS also enforces ownership; the explicit filter keeps intent obvious.
  const { error, count } = await supabase
    .from("music_posts")
    .delete({ count: "exact" })
    .eq("id", postId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: friendlyError(error) };
  if (!count) return { ok: false, error: "You can only delete your own posts." };
  revalidatePath("/");
  return { ok: true };
}
