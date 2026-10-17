"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/auth";
import { uuid } from "@/lib/validation";
import { friendlyError, type ActionResult } from "@/lib/actions/result";

function resolveSongId(input: { songId?: string }): ActionResult<{ id: string }> {
  if (input.songId && uuid.safeParse(input.songId).success) return { ok: true, data: { id: input.songId } };
  return { ok: false, error: "Missing track." };
}

export async function setFavorite(
  input: { songId?: string; providerId?: string },
  favorite: boolean,
): Promise<ActionResult<{ songId: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Log in to save favorites." };
  const song = resolveSongId(input);
  if (!song.ok) return song;

  const supabase = await createClient();
  const { error } = favorite
    ? await supabase.from("favorites").upsert({ user_id: user.id, song_id: song.data!.id }, { onConflict: "user_id,song_id", ignoreDuplicates: true })
    : await supabase.from("favorites").delete().eq("user_id", user.id).eq("song_id", song.data!.id);
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true, data: { songId: song.data!.id } };
}

async function requestCountry(fallback: string | null) {
  const h = await headers();
  const c = (h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry") ?? fallback ?? "ZZ").toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : "ZZ";
}

/**
 * Record a verified listen. The player only calls this after at least 30s of
 * preview audio has actually played (or the preview played to the end).
 * The database additionally rate-limits and de-duplicates events.
 */
export async function recordListen(input: {
  songId?: string;
  providerId?: string;
  event: "preview_30s" | "preview_complete" | "external_open";
  listenedMs: number;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: true }; // anonymous listens are not tracked
  if (!["preview_30s", "preview_complete", "external_open"].includes(input.event)) return { ok: false, error: "Bad event" };
  const listenedMs = Math.max(0, Math.min(3_600_000, Math.round(Number(input.listenedMs) || 0)));
  if (input.event !== "external_open" && listenedMs < 25_000) return { ok: false, error: "Listen too short to count." };

  const song = resolveSongId(input);
  if (!song.ok) return song;

  const supabase = await createClient();
  const { error } = await supabase.from("listening_events").insert({
    user_id: user.id,
    song_id: song.data!.id,
    event_type: input.event,
    listened_ms: listenedMs,
    country: await requestCountry(user.profile.country),
  });
  if (error && error.code !== "P0429") return { ok: false, error: friendlyError(error) };
  return { ok: true };
}
