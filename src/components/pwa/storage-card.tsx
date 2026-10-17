"use client";

import { HardDriveDownload, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { clearAudioCache, getAudioCacheInfo, type AudioCacheInfo } from "@/lib/audio-cache";

function fmtBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(n > 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

/** Shows and clears music saved on this device for instant/offline playback. */
export function StorageCard() {
  const [info, setInfo] = useState<AudioCacheInfo | null | "unsupported">(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const res = await getAudioCacheInfo();
      if (!cancelled) setInfo(res ?? "unsupported");
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mt-6 rounded-2xl border border-line bg-surface p-5">
      <h2 className="flex items-center gap-2 font-bold">
        <HardDriveDownload className="h-4 w-4" aria-hidden /> Saved music
      </h2>
      <p className="mt-1 text-sm text-muted">
        Songs you listen to are kept on this device so they start instantly and play offline. The oldest are removed automatically after 400 MB.
      </p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-sm">
          {info === null ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted" />
          ) : info === "unsupported" ? (
            <span className="text-muted">Available in the installed app or the production site (not in dev mode).</span>
          ) : (
            <>
              <span className="font-semibold tabular-nums">{info.tracks}</span> {info.tracks === 1 ? "song" : "songs"} ·{" "}
              <span className="tabular-nums">{fmtBytes(info.bytes)}</span>
            </>
          )}
        </span>
        {info && info !== "unsupported" && info.tracks > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setInfo((await clearAudioCache()) ?? { tracks: 0, bytes: 0, urls: [] });
              setBusy(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-sm font-semibold text-muted hover:border-down/60 hover:text-down"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Clear
          </button>
        )}
      </div>
    </section>
  );
}
