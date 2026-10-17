"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ChevronDown, ExternalLink, ListMusic } from "lucide-react";
import { useEffect, useRef } from "react";
import { usePlayer } from "@/components/player/player-provider";
import { ProgressBar, TransportControls, VolumeControl } from "@/components/player/controls";
import { Artwork } from "@/components/ui/artwork";
import { artworkAt, cn } from "@/lib/utils";

/** Full-screen "now playing" view with large cover art, like Spotify's expanded player. */
export function NowPlaying({ open, onClose }: { open: boolean; onClose: () => void }) {
  const p = usePlayer();
  const t = p.track;
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !t) return null;
  const big = artworkAt(t.artwork_url, 1000);

  return (
    <div role="dialog" aria-modal="true" aria-label={`Now playing: ${t.title}`} className="fixed inset-0 z-[60] overflow-y-auto bg-bg">
      {/* Blurred cover backdrop */}
      {big && (
        <div aria-hidden className="pointer-events-none fixed inset-0">
          <img src={big} alt="" className="h-full w-full scale-125 object-cover opacity-40 blur-3xl" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-bg/70 to-bg" />
        </div>
      )}

      <div className="relative mx-auto flex min-h-full max-w-6xl flex-col px-5 pb-10 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8">
        <header className="flex items-center justify-between py-3">
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close now playing" className="rounded-full p-2 text-fg/80 hover:bg-white/10 hover:text-fg">
            <ChevronDown className="h-6 w-6" />
          </button>
          <div className="min-w-0 px-3 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{p.source ? "Playing from" : "Now playing"}</div>
            {p.source && <div className="truncate text-sm font-semibold">{p.source}</div>}
          </div>
          <span className="w-10" />
        </header>

        <div className="grid flex-1 items-center gap-10 py-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="mx-auto flex w-full max-w-[min(480px,calc(100dvh-22rem))] min-w-[240px] flex-col">
            <Artwork
              src={t.artwork_url}
              alt={`${t.title} cover art`}
              size={480}
              priority
              rounded="rounded-2xl"
              className={cn("w-full shadow-2xl shadow-black/60 transition-transform duration-500", p.playing ? "scale-100" : "scale-[0.96]")}
            />
            <div className="mt-7 flex items-end justify-between gap-4">
              <div className="min-w-0">
                {t.songId ? (
                  <Link href={`/song/${t.songId}`} onClick={onClose} className="block truncate text-2xl font-bold tracking-tight hover:underline">
                    {t.title}
                  </Link>
                ) : (
                  <div className="truncate text-2xl font-bold tracking-tight">{t.title}</div>
                )}
                <div className="truncate text-muted">{t.artist}</div>
              </div>
              {t.external_url && (
                <a href={t.external_url} target="_blank" rel="noopener noreferrer" aria-label="Listen on Apple Music" className="rounded-full p-2 text-muted hover:text-fg">
                  <ExternalLink className="h-5 w-5" />
                </a>
              )}
            </div>
            <ProgressBar large className="mt-5" />
            <TransportControls size="lg" className="mt-4" />
            <div className="mt-6 flex items-center justify-center gap-3 text-xs text-subtle">
              {t.fullTrack ? "Uploaded on Wavelength" : t.preview_url ? "Preview" : "Audio unavailable"}
            </div>
            <VolumeControl className="mx-auto mt-4 hidden lg:flex" />
            {p.error && <p className="mt-3 text-center text-sm text-down">{p.error}</p>}
          </div>

          <section className="rounded-2xl border border-white/5 bg-black/30 p-4 backdrop-blur-sm lg:max-h-[70vh] lg:overflow-y-auto">
            <h2 className="mb-3 flex items-center gap-2 font-bold">
              <ListMusic className="h-4 w-4" aria-hidden /> Up next
            </h2>
            {p.upNext.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">
                Nothing queued. Press play on an album, chart or shelf to fill your queue.
              </p>
            ) : (
              <ol className="space-y-0.5">
                {p.upNext.slice(0, 50).map((q, i) => (
                  <li key={`${q.providerId}-${i}`}>
                    <button
                      type="button"
                      onClick={() => p.jumpTo(q.providerId)}
                      className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-white/5"
                    >
                      <Artwork src={q.artwork_url} alt="" size={40} className="h-10 w-10" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{q.title}</span>
                        <span className="block truncate text-xs text-muted">{q.artist}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
