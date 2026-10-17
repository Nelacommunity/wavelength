"use client";

import { Pause, Play, Shuffle } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";
import { usePlayer, type PlayableTrack } from "@/components/player/player-provider";
import { cn } from "@/lib/utils";

type Scope = { tracks: PlayableTrack[]; label: string };
const QueueScopeContext = createContext<Scope | null>(null);

/**
 * Declares a playable list (album, chart, shelf, feed). Play buttons inside it
 * queue the whole list, so next/previous/shuffle continue through it.
 */
export function QueueScope({ tracks, label, children }: { tracks: PlayableTrack[]; label: string; children: ReactNode }) {
  return <QueueScopeContext value={{ tracks, label }}>{children}</QueueScopeContext>;
}

export function useQueueScope() {
  return useContext(QueueScopeContext);
}

/** Big green-style play button for a whole list (album header, chart header). */
export function PlayAllButton({ className, size = "lg" }: { className?: string; size?: "md" | "lg" }) {
  const scope = useQueueScope();
  const p = usePlayer();
  if (!scope) return null;
  const playable = scope.tracks.some((t) => t.preview_url);
  const active = p.isSource(scope.label) && p.track;
  const playing = active && p.playing;
  const dims = size === "lg" ? "h-14 w-14" : "h-11 w-11";
  return (
    <button
      type="button"
      disabled={!playable}
      onPointerDown={() => {
        const first = scope.tracks.find((t) => t.preview_url);
        if (!active && !p.shuffle && first) p.prime(first);
      }}
      onPointerEnter={(e) => {
        const first = scope.tracks.find((t) => t.preview_url);
        if (e.pointerType === "mouse" && !active && !p.shuffle && first) p.prime(first);
      }}
      onClick={() => (active ? p.toggle() : p.playList(scope.tracks, scope.label))}
      aria-label={playing ? `Pause ${scope.label}` : `Play ${scope.label}`}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-accent text-black shadow-lg shadow-black/40 transition-transform hover:scale-105 active:scale-95 disabled:opacity-40",
        dims,
        className,
      )}
    >
      {playing ? <Pause className="h-6 w-6" fill="currentColor" /> : <Play className="ml-0.5 h-6 w-6" fill="currentColor" />}
    </button>
  );
}

/** Toggles shuffle; if nothing from this list is playing, starts it shuffled. */
export function ShuffleButton({ className }: { className?: string }) {
  const scope = useQueueScope();
  const p = usePlayer();
  if (!scope) return null;
  const active = p.isSource(scope.label);
  const on = p.shuffle;
  return (
    <button
      type="button"
      onClick={() => (active ? p.toggleShuffle() : p.playList(scope.tracks, scope.label, { shuffle: true }))}
      aria-pressed={on}
      aria-label={on ? "Turn shuffle off" : "Shuffle play"}
      title={on ? "Shuffle on" : "Shuffle"}
      className={cn("relative flex h-11 w-11 items-center justify-center rounded-full transition-colors", on ? "text-accent" : "text-muted hover:text-fg", className)}
    >
      <Shuffle className="h-6 w-6" />
      {on && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent" aria-hidden />}
    </button>
  );
}
