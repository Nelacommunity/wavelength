"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/data/auth";
import { cleanText } from "@/lib/validation";
import { GENRES } from "@/lib/constants";
import type { ActionResult } from "@/lib/actions/result";

const AUDIO_EXT = /\.(mp3|m4a|aac|mp4|wav|ogg|oga|flac|webm)$/i;
const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;
const MAX_TRACKS = 30;
const MAX_TRACKS_PER_DAY = 60;

const trackSchema = z.object({
  title: z.string(),
  audioPath: z.string().max(300),
  coverPath: z.string().max(300).nullable(),
  durationMs: z.number().int().min(1000).max(4 * 60 * 60 * 1000).nullable(),
});

const releaseSchema = z.object({
  kind: z.enum(["single", "album"]),
  title: z.string(),
  description: z.string(),
  genre: z.enum(GENRES),
  releaseDate: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  coverPath: z.string().max(300).nullable(),
  rightsConfirmed: z.literal(true, { message: "Confirm you own the rights to this music." }),
  tracks: z.array(trackSchema).min(1, "Add at least one track.").max(MAX_TRACKS, `An album can have at most ${MAX_TRACKS} tracks.`),
});

export type ReleaseInput = z.input<typeof releaseSchema>;

/** Path must sit in the uploader's own folder: "<uid>/<file>". */
function ownedPath(path: string | null, uid: string, ext: RegExp) {
  return path === null || (path.startsWith(`${uid}/`) && !path.includes("..") && ext.test(path) && path.split("/").length === 2);
}

export async function createRelease(input: ReleaseInput): Promise<ActionResult<{ albumId: string | null; songIds: string[] }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Log in to upload music." };

  const parsed = releaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const r = parsed.data;
  const uid = user.id;

  const title = cleanText(r.title, 200).replace(/\n/g, " ");
  if (!title) return { ok: false, error: r.kind === "album" ? "Give your album a title." : "Give your track a title." };
  if (r.kind === "single" && r.tracks.length !== 1) return { ok: false, error: "A single has exactly one track." };
  if (!r.coverPath) return { ok: false, error: r.kind === "album" ? "Add an album cover." : "Add cover art for your track." };

  if (!ownedPath(r.coverPath, uid, IMAGE_EXT)) return { ok: false, error: "Invalid cover file." };
  for (const t of r.tracks) {
    if (!ownedPath(t.audioPath, uid, AUDIO_EXT)) return { ok: false, error: "Invalid audio file." };
    if (!ownedPath(t.coverPath, uid, IMAGE_EXT)) return { ok: false, error: "Invalid track cover." };
  }

  const admin = createAdminClient();

  // Writes bypass RLS via the service role, so apply the rate limit here.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("songs")
    .select("id", { count: "exact", head: true })
    .eq("uploaded_by", uid)
    .gte("created_at", since);
  if ((count ?? 0) + r.tracks.length > MAX_TRACKS_PER_DAY) {
    return { ok: false, error: `Upload limit reached (${MAX_TRACKS_PER_DAY} tracks per day). Try again tomorrow.` };
  }

  // Every referenced file must actually exist in storage.
  const checks = await Promise.all([
    admin.storage.from("covers").exists(r.coverPath),
    ...r.tracks.map((t) => admin.storage.from("tracks").exists(t.audioPath)),
    ...r.tracks.filter((t) => t.coverPath).map((t) => admin.storage.from("covers").exists(t.coverPath!)),
  ]);
  if (checks.some((c) => !c.data)) return { ok: false, error: "Some files didn't finish uploading. Please try again." };

  const publicUrl = (bucket: string, path: string) => admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  const coverUrl = publicUrl("covers", r.coverPath);
  const rightsAt = new Date().toISOString();
  const artist = user.profile.display_name || user.profile.username;

  let albumId: string | null = null;
  if (r.kind === "album") {
    const { data, error } = await admin
      .from("albums")
      .insert({
        user_id: uid,
        title,
        description: cleanText(r.description, 1000) || null,
        genre: r.genre,
        cover_url: coverUrl,
        cover_path: r.coverPath,
        release_date: r.releaseDate || null,
        rights_confirmed_at: rightsAt,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: "Could not create the album." };
    albumId = data.id;
  }

  const rows = r.tracks.map((t, i) => {
    const id = crypto.randomUUID();
    const trackTitle = r.kind === "single" ? title : cleanText(t.title, 200).replace(/\n/g, " ") || `Track ${i + 1}`;
    return {
      id,
      provider: "upload",
      provider_id: id,
      title: trackTitle,
      artist,
      album: r.kind === "album" ? title : null,
      album_id: albumId,
      track_number: r.kind === "album" ? i + 1 : null,
      artwork_url: t.coverPath ? publicUrl("covers", t.coverPath) : coverUrl,
      cover_path: t.coverPath ?? r.coverPath,
      audio_url: publicUrl("tracks", t.audioPath),
      audio_path: t.audioPath,
      preview_url: null,
      external_url: null,
      genre: r.genre,
      duration_ms: t.durationMs,
      release_date: r.releaseDate || null,
      uploaded_by: uid,
      rights_confirmed_at: rightsAt,
    };
  });

  const { error } = await admin.from("songs").insert(rows);
  if (error) {
    if (albumId) await admin.from("albums").delete().eq("id", albumId);
    return { ok: false, error: "Could not save your tracks." };
  }

  revalidatePath(`/u/${user.profile.username}`);
  return { ok: true, data: { albumId, songIds: rows.map((x) => x.id) } };
}

const appendSchema = z.object({
  albumId: z.string().uuid(),
  rightsConfirmed: z.literal(true, { message: "Confirm you own the rights to this music." }),
  tracks: z.array(trackSchema).min(1, "Add at least one track.").max(MAX_TRACKS, `Add at most ${MAX_TRACKS} tracks at a time.`),
});

export type AppendInput = z.input<typeof appendSchema>;

/** Add more tracks to an album the user already published. */
export async function addTracksToAlbum(input: AppendInput): Promise<ActionResult<{ albumId: string; songIds: string[] }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Log in to upload music." };

  const parsed = appendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const r = parsed.data;
  const uid = user.id;

  for (const t of r.tracks) {
    if (!ownedPath(t.audioPath, uid, AUDIO_EXT)) return { ok: false, error: "Invalid audio file." };
    if (!ownedPath(t.coverPath, uid, IMAGE_EXT)) return { ok: false, error: "Invalid track cover." };
  }

  const admin = createAdminClient();
  const { data: album } = await admin
    .from("albums")
    .select("id, user_id, title, genre, cover_url, cover_path, release_date")
    .eq("id", r.albumId)
    .maybeSingle();
  if (!album || album.user_id !== uid) return { ok: false, error: "You can only add tracks to your own albums." };

  const { data: existing } = await admin
    .from("songs")
    .select("track_number")
    .eq("album_id", album.id)
    .order("track_number", { ascending: false })
    .limit(200);
  if ((existing?.length ?? 0) + r.tracks.length > 200) return { ok: false, error: "An album can have at most 200 tracks." };
  const startNumber = (existing?.[0]?.track_number ?? 0) + 1;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("songs")
    .select("id", { count: "exact", head: true })
    .eq("uploaded_by", uid)
    .gte("created_at", since);
  if ((count ?? 0) + r.tracks.length > MAX_TRACKS_PER_DAY) {
    return { ok: false, error: `Upload limit reached (${MAX_TRACKS_PER_DAY} tracks per day). Try again tomorrow.` };
  }

  const checks = await Promise.all([
    ...r.tracks.map((t) => admin.storage.from("tracks").exists(t.audioPath)),
    ...r.tracks.filter((t) => t.coverPath).map((t) => admin.storage.from("covers").exists(t.coverPath!)),
  ]);
  if (checks.some((c) => !c.data)) return { ok: false, error: "Some files didn't finish uploading. Please try again." };

  const publicUrl = (bucket: string, path: string) => admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  const rightsAt = new Date().toISOString();
  const artist = user.profile.display_name || user.profile.username;

  const rows = r.tracks.map((t, i) => {
    const id = crypto.randomUUID();
    return {
      id,
      provider: "upload",
      provider_id: id,
      title: cleanText(t.title, 200).replace(/\n/g, " ") || `Track ${startNumber + i}`,
      artist,
      album: album.title,
      album_id: album.id,
      track_number: startNumber + i,
      artwork_url: t.coverPath ? publicUrl("covers", t.coverPath) : album.cover_url,
      cover_path: t.coverPath ?? album.cover_path,
      audio_url: publicUrl("tracks", t.audioPath),
      audio_path: t.audioPath,
      preview_url: null,
      external_url: null,
      genre: album.genre,
      duration_ms: t.durationMs,
      release_date: album.release_date,
      uploaded_by: uid,
      rights_confirmed_at: rightsAt,
    };
  });

  const { error } = await admin.from("songs").insert(rows);
  if (error) return { ok: false, error: "Could not save your tracks." };

  revalidatePath(`/album/${album.id}`);
  revalidatePath(`/u/${user.profile.username}`);
  return { ok: true, data: { albumId: album.id, songIds: rows.map((x) => x.id) } };
}

/** Delete a cover file once no song or album references it. */
async function removeCoverIfUnused(admin: ReturnType<typeof createAdminClient>, path: string | null) {
  if (!path) return;
  const [{ count: songUses }, { count: albumUses }] = await Promise.all([
    admin.from("songs").select("id", { count: "exact", head: true }).eq("cover_path", path),
    admin.from("albums").select("id", { count: "exact", head: true }).eq("cover_path", path),
  ]);
  if (!songUses && !albumUses) await admin.storage.from("covers").remove([path]);
}

async function verifyNewCover(admin: ReturnType<typeof createAdminClient>, uid: string, coverPath: string) {
  if (!ownedPath(coverPath, uid, IMAGE_EXT)) return "Invalid cover file.";
  const { data: exists } = await admin.storage.from("covers").exists(coverPath);
  return exists ? null : "The image didn't finish uploading. Please try again.";
}

/** Give one uploaded song its own cover picture. */
export async function updateSongCover(songId: string, coverPath: string): Promise<ActionResult<{ artworkUrl: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Log in first." };
  if (!z.string().uuid().safeParse(songId).success) return { ok: false, error: "Invalid track." };

  const admin = createAdminClient();
  const bad = await verifyNewCover(admin, user.id, coverPath);
  if (bad) return { ok: false, error: bad };

  const { data: song } = await admin.from("songs").select("id, uploaded_by, cover_path, album_id").eq("id", songId).maybeSingle();
  if (!song || song.uploaded_by !== user.id) return { ok: false, error: "You can only change covers of your own uploads." };

  const artworkUrl = admin.storage.from("covers").getPublicUrl(coverPath).data.publicUrl;
  const { error } = await admin.from("songs").update({ artwork_url: artworkUrl, cover_path: coverPath }).eq("id", songId);
  if (error) return { ok: false, error: "Could not update the cover." };
  await removeCoverIfUnused(admin, song.cover_path);

  revalidatePath(`/song/${songId}`);
  if (song.album_id) revalidatePath(`/album/${song.album_id}`);
  return { ok: true, data: { artworkUrl } };
}

/**
 * Change an album's cover. Tracks that were using the old album cover follow
 * it; tracks with their own picture keep it.
 */
export async function updateAlbumCover(albumId: string, coverPath: string): Promise<ActionResult<{ coverUrl: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Log in first." };
  if (!z.string().uuid().safeParse(albumId).success) return { ok: false, error: "Invalid album." };

  const admin = createAdminClient();
  const bad = await verifyNewCover(admin, user.id, coverPath);
  if (bad) return { ok: false, error: bad };

  const { data: album } = await admin.from("albums").select("id, user_id, cover_path").eq("id", albumId).maybeSingle();
  if (!album || album.user_id !== user.id) return { ok: false, error: "You can only change your own albums." };

  const coverUrl = admin.storage.from("covers").getPublicUrl(coverPath).data.publicUrl;
  const { error } = await admin.from("albums").update({ cover_url: coverUrl, cover_path: coverPath }).eq("id", albumId);
  if (error) return { ok: false, error: "Could not update the cover." };
  if (album.cover_path) {
    await admin
      .from("songs")
      .update({ artwork_url: coverUrl, cover_path: coverPath })
      .eq("album_id", albumId)
      .eq("cover_path", album.cover_path);
  }
  await removeCoverIfUnused(admin, album.cover_path);

  revalidatePath(`/album/${albumId}`);
  revalidatePath(`/u/${user.profile.username}`);
  return { ok: true, data: { coverUrl } };
}

/** Remove a user's own uploaded track (row + audio file). */
export async function deleteUploadedSong(songId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Log in first." };
  if (!z.string().uuid().safeParse(songId).success) return { ok: false, error: "Invalid track." };

  const admin = createAdminClient();
  const { data: song } = await admin.from("songs").select("id, uploaded_by, audio_path, cover_path, album_id").eq("id", songId).maybeSingle();
  if (!song || song.uploaded_by !== user.id) return { ok: false, error: "You can only delete your own uploads." };

  const { error } = await admin.from("songs").delete().eq("id", songId);
  if (error) return { ok: false, error: "Could not delete the track." };
  await admin.storage.from("tracks").remove([song.audio_path]);
  // Keep the cover if the album (or another track) still uses it.
  const { count } = await admin.from("songs").select("id", { count: "exact", head: true }).eq("cover_path", song.cover_path);
  const { count: albumUses } = await admin.from("albums").select("id", { count: "exact", head: true }).eq("cover_path", song.cover_path);
  if (!count && !albumUses && song.cover_path) await admin.storage.from("covers").remove([song.cover_path]);

  revalidatePath(`/u/${user.profile.username}`);
  return { ok: true };
}

/** Remove a user's own album with all of its tracks and files. */
export async function deleteAlbum(albumId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Log in first." };
  if (!z.string().uuid().safeParse(albumId).success) return { ok: false, error: "Invalid album." };

  const admin = createAdminClient();
  const { data: album } = await admin.from("albums").select("id, user_id, cover_path").eq("id", albumId).maybeSingle();
  if (!album || album.user_id !== user.id) return { ok: false, error: "You can only delete your own albums." };

  const { data: songs } = await admin.from("songs").select("audio_path, cover_path").eq("album_id", albumId);
  const { error } = await admin.from("albums").delete().eq("id", albumId); // songs cascade
  if (error) return { ok: false, error: "Could not delete the album." };

  const audio = (songs ?? []).map((s) => s.audio_path).filter(Boolean);
  const covers = [...new Set([album.cover_path, ...(songs ?? []).map((s) => s.cover_path)].filter(Boolean))];
  if (audio.length) await admin.storage.from("tracks").remove(audio);
  if (covers.length) await admin.storage.from("covers").remove(covers);

  revalidatePath(`/u/${user.profile.username}`);
  return { ok: true };
}

/** Best-effort cleanup of files uploaded for a release that was abandoned. */
export async function discardUploads(paths: { bucket: "tracks" | "covers"; path: string }[]): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Log in first." };
  const supabase = await createClient(); // user client: storage RLS limits this to their own folder
  for (const bucket of ["tracks", "covers"] as const) {
    const mine = paths.filter((p) => p.bucket === bucket && p.path.startsWith(`${user.id}/`)).map((p) => p.path);
    if (mine.length) await supabase.storage.from(bucket).remove(mine.slice(0, 100));
  }
  return { ok: true };
}
