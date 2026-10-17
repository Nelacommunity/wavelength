"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteAlbum, deleteUploadedSong } from "@/lib/actions/uploads";

/** Two-step delete for an uploader's own album or track. */
export function OwnerDelete({ kind, id, redirectTo, compact }: { kind: "album" | "song"; id: string; redirectTo?: string; compact?: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Delete ${kind}`}
        title={`Delete ${kind}`}
        className={compact ? "rounded-full p-2 text-subtle hover:text-down" : "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-muted hover:bg-down/10 hover:text-down"}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        {!compact && `Delete ${kind}`}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = kind === "album" ? await deleteAlbum(id) : await deleteUploadedSong(id);
            if (!res.ok) {
              setError(res.error);
              return;
            }
            if (redirectTo) router.push(redirectTo);
            else router.refresh();
          })
        }
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-down/15 px-3 text-sm font-semibold text-down"
      >
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {kind === "album" ? "Delete album & tracks" : "Delete track"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="h-9 rounded-full px-3 text-sm text-muted hover:text-fg">
        Cancel
      </button>
      {error && <span role="alert" className="text-xs text-down">{error}</span>}
    </span>
  );
}
