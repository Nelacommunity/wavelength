"use client";

import { ImagePlus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { discardUploads, updateAlbumCover, updateSongCover } from "@/lib/actions/uploads";
import { cn } from "@/lib/utils";

const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const MAX_IMAGE = 5 * 1024 * 1024;

/** Lets an uploader replace the cover picture of their song or album. */
export function CoverEditor({
  kind,
  id,
  userId,
  children,
  variant = "overlay",
  className,
}: {
  kind: "song" | "album";
  id: string;
  userId: string;
  children?: ReactNode;
  /** "overlay": button over the artwork; "button": small icon button (track rows). */
  variant?: "overlay" | "button";
  className?: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const onFile = async (file: File) => {
    const ext = IMAGE_TYPES[file.type];
    if (!ext) return setError("Use a PNG, JPG or WebP image.");
    if (file.size > MAX_IMAGE) return setError("Cover images must be 5 MB or smaller.");
    setError(null);
    setBusy(true);
    setPreview(URL.createObjectURL(file));

    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const supabase = createClient();
    const { error: upErr } = await supabase.storage.from("covers").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
    if (upErr) {
      setBusy(false);
      setPreview(null);
      return setError(upErr.message.toLowerCase().includes("bucket") ? "Cover storage isn't set up. Run the uploads migration." : "Upload failed. Please try again.");
    }
    const res = kind === "song" ? await updateSongCover(id, path) : await updateAlbumCover(id, path);
    if (!res.ok) {
      void discardUploads([{ bucket: "covers", path }]);
      setPreview(null);
      setError(res.error);
    } else {
      router.refresh();
    }
    setBusy(false);
  };

  const picker = (
    <input
      ref={input}
      type="file"
      accept="image/png,image/jpeg,image/webp"
      className="sr-only"
      tabIndex={-1}
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f) void onFile(f);
      }}
    />
  );

  if (variant === "button") {
    return (
      <>
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          aria-label="Change this song's cover"
          title={error ?? "Change cover"}
          className={cn("rounded-full p-2 transition-colors", error ? "text-down" : "text-subtle hover:text-fg", className)}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        </button>
        {picker}
      </>
    );
  }

  return (
    <div className={cn("group relative w-fit", className)}>
      {children}
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="absolute inset-0 h-full w-full rounded-xl object-cover" />
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-black/60 text-sm font-semibold opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100 max-lg:inset-auto max-lg:bottom-2 max-lg:right-2 max-lg:flex-row max-lg:rounded-full max-lg:px-3 max-lg:py-2 max-lg:opacity-100"
        aria-label={kind === "song" ? "Change song cover" : "Change album cover"}
      >
        {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6 max-lg:h-4 max-lg:w-4" />}
        {busy ? "Uploading…" : "Change cover"}
      </button>
      {picker}
      {error && (
        <p role="alert" className="mt-2 max-w-60 text-xs text-down">
          {error}
        </p>
      )}
    </div>
  );
}
