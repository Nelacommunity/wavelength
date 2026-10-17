"use client";

import { Loader2, Pause, Play } from "lucide-react";
import { usePlayer, type PlayableTrack } from "@/components/player/player-provider";
import { useQueueScope } from "@/components/player/queue-scope";
import { cn } from "@/lib/utils";

export function PlayButton({
  track,
  size = "md",
  className,
}: {
  track: PlayableTrack;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const p = usePlayer();
  const scope = useQueueScope();
  const current = p.isCurrent(track.providerId);
  const playing = current && p.playing;
  const loading = current && p.loading;
  const dims = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-14 w-14" : "h-10 w-10";
  const icon = size === "lg" ? "h-6 w-6" : "h-4 w-4";

  return (
    <button
      type="button"
      // Start buffering on press, ~100–300 ms before the click fires.
      onPointerDown={() => !current && p.prime(track)}
      // Desktop: hovering is a strong intent signal — start buffering early.
      onPointerEnter={(e) => e.pointerType === "mouse" && !current && p.prime(track)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (current && track.preview_url && p.playing) p.toggle();
        else if (scope?.tracks.some((t) => t.providerId === track.providerId)) p.play(track, scope.tracks, scope.label);
        else p.play(track);
      }}
      aria-label={!track.preview_url ? `Show ${track.title} in player` : playing ? `Pause ${track.title}` : `Play ${track.fullTrack ? "" : "preview of "}${track.title}`}
      title={track.preview_url ? undefined : "No preview available"}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-accent text-black shadow-lg shadow-black/40 transition-transform hover:scale-105 active:scale-95",
        !track.preview_url && "bg-surface-3 text-muted",
        dims,
        className,
      )}
    >
      {loading ? (
        <Loader2 className={cn(icon, "animate-spin")} />
      ) : playing ? (
        <Pause className={icon} fill="currentColor" />
      ) : (
        <Play className={cn(icon, "ml-0.5")} fill="currentColor" />
      )}
    </button>
  );
}

export function NowPlayingBars({ providerId, className }: { providerId: string; className?: string }) {
  const p = usePlayer();
  if (!p.isCurrent(providerId) || !p.playing) return null;
  return (
    <span className={cn("inline-flex h-3 items-end gap-[2px]", className)} aria-label="Now playing">
      {[0, 0.2, 0.4].map((d) => (
        <span key={d} className="eq-bar h-full w-[3px] rounded-sm bg-accent" style={{ animationDelay: `${d}s` }} />
      ))}
    </span>
  );
}
