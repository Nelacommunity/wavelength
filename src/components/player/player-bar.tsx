"use client";

import { ExternalLink, Loader2, Maximize2, Music2, Pause, Play, SkipForward } from "lucide-react";
import { useCallback, useState } from "react";
import { Artwork } from "@/components/ui/artwork";
import { usePlayer } from "@/components/player/player-provider";
import { ProgressBar, TransportControls, VolumeControl } from "@/components/player/controls";
import { NowPlaying } from "@/components/player/now-playing";

export function PlayerBar() {
  const p = usePlayer();
  const [expanded, setExpanded] = useState(false);
  const close = useCallback(() => setExpanded(false), []);
  const t = p.track;
  const canPlay = Boolean(t?.preview_url);
  const pct = p.duration ? (p.currentTime / p.duration) * 100 : 0;

  if (!t) {
    return (
      <div className="hidden h-[72px] items-center justify-center gap-2 border-t border-line bg-surface/95 px-4 text-sm text-subtle backdrop-blur lg:flex">
        <Music2 className="h-4 w-4" aria-hidden />
        Press play on any song or album to start listening
      </div>
    );
  }

  const subtitle = t.fullTrack ? null : canPlay ? " · Preview" : " · No preview available";

  return (
    <>
      <NowPlaying open={expanded} onClose={close} />
      <div className="relative border-t border-line bg-surface/95 backdrop-blur" role="region" aria-label="Player">
        {/* Mobile progress line */}
        {canPlay && (
          <div className="absolute inset-x-0 top-0 h-0.5 bg-line lg:hidden">
            <div className="h-full bg-fg" style={{ width: `${pct}%` }} />
          </div>
        )}

        {/* Mobile mini player: tap to expand */}
        <div className="flex h-16 items-center gap-3 px-3 lg:hidden">
          <button type="button" onClick={() => setExpanded(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label="Open now playing">
            <Artwork src={t.artwork_url} alt="" size={44} className="h-11 w-11" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{t.title}</span>
              <span className="block truncate text-xs text-muted">
                {t.artist}
                {subtitle && <span className="text-subtle">{subtitle}</span>}
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={p.toggle}
            disabled={!canPlay}
            aria-label={p.playing ? "Pause" : "Play"}
            className="flex h-10 w-10 items-center justify-center rounded-full text-fg disabled:text-subtle"
          >
            {p.loading ? <Loader2 className="h-5 w-5 animate-spin" /> : p.playing ? <Pause className="h-6 w-6" fill="currentColor" /> : <Play className="h-6 w-6" fill="currentColor" />}
          </button>
          <button type="button" onClick={p.next} disabled={!p.hasNext} aria-label="Next" className="flex h-10 w-10 items-center justify-center rounded-full text-fg disabled:text-subtle">
            <SkipForward className="h-5 w-5" fill="currentColor" />
          </button>
        </div>

        {/* Desktop bar */}
        <div className="hidden h-[80px] grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] items-center gap-4 px-4 lg:grid">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setExpanded(true)} className="group relative shrink-0" aria-label="Open now playing">
              <Artwork src={t.artwork_url} alt="" size={56} className="h-14 w-14" />
              <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <Maximize2 className="h-4 w-4" />
              </span>
            </button>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{t.title}</div>
              <div className="truncate text-xs text-muted">
                {t.artist}
                {subtitle && <span className="text-subtle">{subtitle}</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1">
            <TransportControls />
            <ProgressBar className="w-full max-w-xl" />
            {p.error && <span className="text-xs text-down">{p.error}</span>}
          </div>

          <div className="flex items-center justify-end gap-3">
            {t.external_url ? (
              <a
                href={t.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-fg/60 hover:text-fg xl:inline-flex"
              >
                Apple Music
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            ) : (
              <span className="hidden text-xs text-subtle xl:inline">Full track</span>
            )}
            <button type="button" onClick={() => setExpanded(true)} aria-label="Open now playing view" title="Now playing view" className="rounded-full p-1.5 text-muted hover:text-fg">
              <Maximize2 className="h-4 w-4" />
            </button>
            <VolumeControl />
          </div>
        </div>
      </div>
    </>
  );
}
