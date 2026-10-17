"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/auth";
import { cleanText, profileSchema } from "@/lib/validation";
import { friendlyError } from "@/lib/actions/result";

export type ProfileState = { error?: string } | undefined;

const MAX_AVATAR = 2 * 1024 * 1024;
const AVATAR_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Log in first." };

  const parsed = profileSchema.safeParse({
    username: String(formData.get("username") ?? ""),
    display_name: cleanText(formData.get("display_name"), 50).replace(/\n/g, " "),
    bio: cleanText(formData.get("bio"), 280),
    country: String(formData.get("country") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const update: Record<string, string | null> = {
    username: parsed.data.username,
    display_name: parsed.data.display_name || null,
    bio: parsed.data.bio || null,
    country: parsed.data.country || null,
  };

  const avatar = formData.get("avatar");
  if (avatar instanceof File && avatar.size > 0) {
    const ext = AVATAR_TYPES[avatar.type];
    if (!ext) return { error: "Avatar must be a PNG, JPEG, WebP or GIF." };
    if (avatar.size > MAX_AVATAR) return { error: "Avatar must be 2 MB or smaller." };
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, avatar, { contentType: avatar.type, upsert: false });
    if (upErr) return { error: "Could not upload your avatar." };
    update.avatar_url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  }

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) {
    if (error.code === "23505") return { error: "That username is taken." };
    return { error: friendlyError(error, "Could not save your profile.") };
  }
  revalidatePath("/", "layout");
  redirect(`/u/${parsed.data.username}`);
}
