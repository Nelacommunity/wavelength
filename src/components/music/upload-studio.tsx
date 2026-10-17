"use client";

/* eslint-disable @next/next/no-img-element */
import { ArrowDown, ArrowUp, CircleCheck, Disc3, ImagePlus, Loader2, Music, Trash2, TriangleAlert, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addTracksToAlbum, createRelease, discardUploads } from "@/lib/actions/uploads";
import { GENRES } from "@/lib/constants";
import { cn } from "@/lib/utils";

const MAX_AUDIO = 50 * 1024 * 1024;
const MAX_IMAGE = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const AUDIO_EXT = ["mp3", "m4a", "aac", "mp4", "wav", "ogg", "oga", "flac", "webm"];

type Status = "idle" | "uploading" | "done" | "error";
type Cover = { file: File | null; preview: string };
export type ExistingAlbum = { id: string; title: string; cover_url: string | null; trackCount: number };
type Track = { key: string; file: File; title: string; durationMs: number | null; cover: Cover | null; status: Status };

const field =
  "w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[15px] placeholder:text-subtle focus:border-accent focus:outline-none";

function extOf(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (AUDIO_EXT.includes(fromName) || ["png", "jpg", "jpeg", "webp"].includes(fromName)) return fromName;
  const fromType: Record<string, string> = { "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-m4a": "m4a", "audio/mp4": "m4a", "audio/ogg": "ogg", "audio/flac": "flac", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
  return fromType[file.type] ?? "bin";
}

function titleFromFile(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/^\d{1,3}[\s._-]+/, "")
    .replace(/[_]+/g, " ")
    .trim()
    .slice(0, 200);
}

function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    const done = (v: number | null) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : null);
    audio.onerror = () => done(null);
    audio.src = url;
  });
}

function fmtDuration(ms: number | null) {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function CoverPicker({ cover, onPick, label, size = "lg" }: { cover: Cover | null; onPick: (c: Cover) => void; label: string; size?: "lg" | "sm" }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <label
        className={cn(
          "group relative flex cursor-pointer items-center justify-center overflow-hidden border border-dashed border-line-strong bg-surface-2 text-subtle transition-colors hover:border-accent hover:text-accent",
          size === "lg" ? "aspect-square w-full max-w-[240px] rounded-2xl" : "h-12 w-12 shrink-0 rounded-lg",
        )}
        title={label}
      >
        {cover ? (
          <img src={cover.preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : size === "lg" ? (
          <span className="flex flex-col items-center gap-2 p-4 text-center text-sm">
            <ImagePlus className="h-7 w-7" aria-hidden />
            {label}
            <span className="text-xs text-subtle">PNG, JPG or WebP · up to 5 MB · square works best</span>
          </span>
        ) : (
          <ImagePlus className="h-4 w-4" aria-hidden />
        )}
        {cover && size === "lg" && (
          <span className="absolute inset-x-0 bottom-0 bg-black/60 py-2 text-center text-xs font-semibold text-fg opacity-0 transition-opacity group-hover:opacity-100">
            Change cover
          </span>
        )}
        <input
          type="file"
          accept={IMAGE_TYPES.join(",")}
          className="sr-only"
          aria-label={label}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            if (!IMAGE_TYPES.includes(f.type)) return setError("Use a PNG, JPG or WebP image.");
            if (f.size > MAX_IMAGE) return setError("Cover images must be 5 MB or smaller.");
            setError(null);
            onPick({ file: f, preview: URL.createObjectURL(f) });
          }}
        />
      </label>
      {error && <p className="mt-1.5 text-xs text-down">{error}</p>}
    </div>
  );
}

export function UploadStudio({
  userId,
  artistName,
  albums = [],
  initialAlbumId = null,
}: {
  userId: string;
  artistName: string;
  albums?: ExistingAlbum[];
  initialAlbumId?: string | null;
}) {
  const router = useRouter();
  const startAlbum = albums.find((a) => a.id === initialAlbumId) ?? null;
  const [kind, setKind] = useState<"single" | "album" | "existing">(startAlbum ? "existing" : "album");
  const [albumId, setAlbumId] = useState<string | null>(startAlbum?.id ?? albums[0]?.id ?? null);
  const existing = kind === "existing" ? albums.find((a) => a.id === albumId) ?? null : null;
  const multi = kind !== "single";
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState<string>(GENRES[0]);
  const [releaseDate, setReleaseDate] = useState("");
  const [cover, setCover] = useState<Cover | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const fallbackCover: Cover | null = existing ? (existing.cover_url ? { file: null, preview: existing.cover_url } : null) : cover;
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Warn before leaving mid-upload.
  useEffect(() => {
    if (!busy) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [busy]);

  const addFiles = async (files: FileList | File[]) => {
    const list = [...files];
    const rejected: string[] = [];
    const accepted: Track[] = [];
    for (const f of list) {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (!(f.type.startsWith("audio/") || AUDIO_EXT.includes(ext))) {
        rejected.push(`${f.name} isn't an audio file`);
        continue;
      }
      if (f.size > MAX_AUDIO) {
        rejected.push(`${f.name} is larger than 50 MB`);
        continue;
      }
      accepted.push({ key: crypto.randomUUID(), file: f, title: titleFromFile(f.name), durationMs: await readDuration(f), cover: null, status: "idle" });
    }
    setError(rejected.length ? rejected.join(" · ") : null);
    setTracks((t) => (kind === "single" ? accepted.slice(0, 1) : [...t, ...accepted].slice(0, 30)));
    if (kind === "single" && accepted[0] && !title) setTitle(accepted[0].title);
  };

  const update = (key: string, patch: Partial<Track>) => setTracks((ts) => ts.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  const move = (i: number, d: -1 | 1) =>
    setTracks((ts) => {
      const j = i + d;
      if (j < 0 || j >= ts.length) return ts;
      const copy = [...ts];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const submit = async () => {
    setError(null);
    if (tracks.length === 0) return setError("Add at least one audio file.");
    if (kind === "existing") {
      if (!existing) return setError("Choose the album to add tracks to.");
    } else {
      if (!title.trim()) return setError(kind === "album" ? "Give your album a title." : "Give your track a title.");
      if (!cover?.file) return setError(kind === "album" ? "Add an album cover." : "Add cover art.");
    }
    if (!rights) return setError("Confirm you own the rights to this music.");

    setBusy(true);
    const supabase = createClient();
    const uploaded: { bucket: "tracks" | "covers"; path: string }[] = [];
    const put = async (bucket: "tracks" | "covers", file: File) => {
      const path = `${userId}/${crypto.randomUUID()}.${extOf(file)}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
        contentType: file.type || undefined,
        cacheControl: "31536000",
        upsert: false,
      });
      if (upErr) {
        const msg = upErr.message.toLowerCase();
        if (msg.includes("bucket not found")) {
          throw new Error("Uploads aren't set up on the server yet: the storage buckets are missing. Run the uploads migration in Supabase.");
        }
        if (msg.includes("size") || msg.includes("too large")) throw new Error(`${file.name} is too large.`);
        if (msg.includes("mime") || msg.includes("type")) throw new Error(`${file.name} isn't a supported file type.`);
        if (msg.includes("row-level security") || msg.includes("unauthorized")) throw new Error("You don't have permission to upload. Try logging out and back in.");
        throw new Error(`Upload failed for ${file.name}: ${upErr.message}`);
      }
      uploaded.push({ bucket, path });
      return path;
    };

    try {
      let coverPath: string | null = null;
      if (kind !== "existing") {
        setProgress("Uploading cover…");
        coverPath = await put("covers", cover!.file!);
      }
      const results: { title: string; audioPath: string; coverPath: string | null; durationMs: number | null }[] = [];
      for (const [i, t] of tracks.entries()) {
        setProgress(`Uploading track ${i + 1} of ${tracks.length}…`);
        update(t.key, { status: "uploading" });
        try {
          const audioPath = await put("tracks", t.file);
          const trackCover = t.cover?.file ? await put("covers", t.cover.file) : null;
          results.push({ title: t.title, audioPath, coverPath: trackCover, durationMs: t.durationMs });
          update(t.key, { status: "done" });
        } catch (e) {
          update(t.key, { status: "error" });
          throw e;
        }
      }

      setProgress("Publishing…");
      if (kind === "existing") {
        const added = await addTracksToAlbum({ albumId: existing!.id, rightsConfirmed: true, tracks: results });
        if (!added.ok) throw new Error(added.error);
        setProgress("Done!");
        router.push(`/album/${existing!.id}?added=${results.length}`);
        return;
      }
      const res = await createRelease({
        kind: kind as "album" | "single",
        title,
        description,
        genre: genre as (typeof GENRES)[number],
        releaseDate,
        coverPath,
        rightsConfirmed: true,
        tracks: results,
      });
      if (!res.ok) throw new Error(res.error);
      setProgress("Done!");
      router.push(res.data!.albumId ? `/album/${res.data!.albumId}?new=1` : `/song/${res.data!.songIds[0]}`);
    } catch (e) {
      if (uploaded.length) void discardUploads(uploaded);
      setError((e as Error).message || "Upload failed. Please try again.");
      setProgress(null);
      setBusy(false);
      setTracks((ts) => ts.map((t) => ({ ...t, status: t.status === "done" ? "idle" : t.status })));
    }
  };

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-full bg-surface-2 p-1" role="tablist" aria-label="Release type">
        {([...(albums.length ? (["existing"] as const) : []), "album", "single"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            disabled={busy}
            onClick={() => {
              setKind(k);
              if (k === "single") setTracks((t) => t.slice(0, 1));
            }}
            className={cn("rounded-full px-4 py-1.5 text-sm font-medium transition-colors", kind === k ? "bg-fg text-black" : "text-muted hover:text-fg")}
          >
            {k === "existing" ? "Add to existing album" : k === "album" ? "New album / EP" : "Single track"}
          </button>
        ))}
      </div>

      {kind === "existing" ? (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-1 font-bold">Choose an album</h2>
          <p className="mb-4 text-sm text-muted">New tracks are added after the existing ones and use the album cover unless you give them their own.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {albums.map((a) => (
              <button
                key={a.id}
                type="button"
                disabled={busy}
                onClick={() => setAlbumId(a.id)}
                aria-pressed={a.id === albumId}
                className={cn(
                  "rounded-xl border p-2 text-left transition-colors",
                  a.id === albumId ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong hover:bg-surface-2",
                )}
              >
                {a.cover_url ? (
                  <img src={a.cover_url} alt="" className="aspect-square w-full rounded-lg object-cover" />
                ) : (
                  <span className="flex aspect-square w-full items-center justify-center rounded-lg bg-surface-3 text-subtle">
                    <Disc3 className="h-8 w-8" aria-hidden />
                  </span>
                )}
                <span className="mt-2 block truncate text-sm font-semibold">{a.title}</span>
                <span className="block text-xs text-muted">
                  {a.trackCount} {a.trackCount === 1 ? "track" : "tracks"}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : (
      <div className="grid gap-6 rounded-2xl border border-line bg-surface p-5 md:grid-cols-[240px_minmax(0,1fr)]">
        <CoverPicker cover={cover} onPick={setCover} label={kind === "album" ? "Add album cover" : "Add cover art"} />
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">{kind === "album" ? "Album title" : "Track title"}</span>
            <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 200))} className={field} placeholder={kind === "album" ? "e.g. Midnight Tapes" : "e.g. Golden Hour"} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Genre</span>
              <select value={genre} onChange={(e) => setGenre(e.target.value)} className={field}>
                {GENRES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Release date <span className="font-normal text-subtle">(optional)</span></span>
              <input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} className={field} />
            </label>
          </div>
          {kind === "album" && (
            <label className="block">
              <span className="mb-1.5 flex justify-between text-sm font-medium">
                Description <span className="font-normal text-subtle">{description.length}/1000</span>
              </span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 1000))} rows={3} className={`${field} resize-none`} placeholder="Tell listeners about this release" />
            </label>
          )}
          <p className="text-sm text-muted">
            Artist: <span className="font-semibold text-fg">{artistName}</span> <span className="text-subtle">(your display name)</span>
          </p>
        </div>
      </div>
      )}

      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">{multi ? `Tracks${tracks.length ? ` · ${tracks.length}` : ""}` : "Audio file"}</h2>
          {multi && tracks.length > 0 && <span className="text-xs text-subtle">Add a cover per track, or leave it to use the album cover</span>}
        </div>

        {tracks.length > 0 && (
          <ol className="mb-4 space-y-2">
            {tracks.map((t, i) => (
              <li key={t.key} className="flex items-center gap-3 rounded-xl bg-surface-2 p-2.5">
                <span className="w-6 text-center text-sm font-semibold tabular-nums text-muted">{multi ? (existing?.trackCount ?? 0) + i + 1 : <Music className="mx-auto h-4 w-4" />}</span>
                {multi && <CoverPicker size="sm" cover={t.cover ?? fallbackCover} onPick={(c) => update(t.key, { cover: c })} label={`Cover for ${t.title || "track"}`} />}
                <div className="min-w-0 flex-1">
                  {multi ? (
                    <input
                      value={t.title}
                      onChange={(e) => update(t.key, { title: e.target.value.slice(0, 200) })}
                      aria-label={`Title of track ${i + 1}`}
                      className="w-full rounded-lg bg-transparent px-1.5 py-1 text-sm font-semibold focus:bg-surface-3 focus:outline-none"
                    />
                  ) : (
                    <div className="truncate px-1.5 text-sm font-semibold">{t.file.name}</div>
                  )}
                  <div className="truncate px-1.5 text-xs text-subtle">
                    {fmtDuration(t.durationMs)} · {(t.file.size / 1024 / 1024).toFixed(1)} MB
                  </div>
                </div>
                <span className="w-5" aria-live="polite">
                  {t.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-accent" aria-label="Uploading" />}
                  {t.status === "done" && <CircleCheck className="h-4 w-4 text-up" aria-label="Uploaded" />}
                  {t.status === "error" && <TriangleAlert className="h-4 w-4 text-down" aria-label="Failed" />}
                </span>
                {multi && (
                  <div className="flex">
                    <button type="button" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label="Move up" className="rounded-full p-1.5 text-muted hover:text-fg disabled:opacity-30">
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button type="button" disabled={busy || i === tracks.length - 1} onClick={() => move(i, 1)} aria-label="Move down" className="rounded-full p-1.5 text-muted hover:text-fg disabled:opacity-30">
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <button type="button" disabled={busy} onClick={() => setTracks((ts) => ts.filter((x) => x.key !== t.key))} aria-label="Remove track" className="rounded-full p-1.5 text-subtle hover:text-down disabled:opacity-30">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ol>
        )}

        {(multi || tracks.length === 0) && (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!busy) void addFiles(e.dataTransfer.files);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center transition-colors",
              dragging ? "border-accent bg-accent-soft" : "border-line-strong hover:border-accent",
            )}
          >
            <Upload className="h-6 w-6 text-accent" aria-hidden />
            <span className="font-semibold">{multi ? "Drop audio files or click to add tracks" : "Drop an audio file or click to choose"}</span>
            <span className="text-xs text-subtle">MP3, M4A/AAC, WAV, FLAC or OGG · up to 50 MB each{multi ? " · up to 30 tracks" : ""}</span>
            <input
              type="file"
              accept="audio/*,.mp3,.m4a,.aac,.wav,.flac,.ogg"
              multiple={multi}
              disabled={busy}
              className="sr-only"
              onChange={(e) => {
                if (e.target.files) void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </section>

      <label className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-sm">
        <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#9b7bff]" />
        <span>
          <span className="font-semibold">I own or control the rights to this music and artwork.</span>{" "}
          <span className="text-muted">Only upload your own work or music you have permission to share. Uploaded audio is publicly streamable on Wavelength.</span>
        </span>
      </label>

      {error && (
        <p role="alert" className="rounded-xl bg-down/10 px-4 py-3 text-sm text-down">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        {progress && <span className="text-sm text-muted" aria-live="polite">{progress}</span>}
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-6 font-semibold text-black transition-opacity disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Disc3 className="h-4 w-4" />}
          {busy
            ? "Publishing…"
            : kind === "existing"
              ? `Add ${tracks.length || ""} ${tracks.length === 1 ? "track" : "tracks"} to album`.replace("  ", " ")
              : kind === "album"
                ? "Publish album"
                : "Publish track"}
        </button>
      </div>
    </div>
  );
}
