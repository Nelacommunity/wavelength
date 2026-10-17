"use client";

import { Loader2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from "lucide-react";
import type { CSSProperties } from "react";
import { usePlayer } from "@/components/player/player-provider";
import { cn } from "@/lib/utils";

export function fmtTime(s: number) {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

function ToggleDot({ on }: { on: boolean }) {
  return on ? <span className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" aria-hidden /> : null;
}

/** Shuffle · previous · play/pause · next · repeat */
export function TransportControls({ size = "md", className }: { size?: "md" | "lg"; className?: string }) {
  const p = usePlayer();
  const canPlay = Boolean(p.track?.preview_url);
  const icon = size === "lg" ? "h-6 w-6" : "h-[18px] w-[18px]";
  const main = size === "lg" ? "h-16 w-16" : "h-9 w-9";
  const mainIcon = size === "lg" ? "h-7 w-7" : "h-4 w-4";
  const side = "relative flex items-center justify-center rounded-full p-2 transition-colors disabled:opacity-30";
  const RepeatIcon = p.repeat === "one" ? Repeat1 : Repeat;

  return (
    <div className={cn("flex items-center justify-center", size === "lg" ? "gap-5 sm:gap-7" : "gap-3", className)}>
      <button
        type="button"
        onClick={p.toggleShuffle}
        aria-pressed={p.shuffle}
        aria-label={p.shuffle ? "Disable shuffle" : "Enable shuffle"}
        title={p.shuffle ? "Disable shuffle" : "Enable shuffle"}
        className={cn(side, p.shuffle ? "text-accent" : "text-muted hover:text-fg")}
      >
        <Shuffle className={icon} />
        <ToggleDot on={p.shuffle} />
      </button>
      <button type="button" onClick={p.previous} disabled={!p.hasPrevious} aria-label="Previous" title="Previous" className={cn(side, "text-muted hover:text-fg")}>
        <SkipBack className={icon} fill="currentColor" />
      </button>
      <button
        type="button"
        onClick={p.toggle}
        disabled={!canPlay}
        aria-label={p.playing ? "Pause" : "Play"}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-fg text-black transition-transform hover:scale-105 active:scale-95 disabled:bg-surface-3 disabled:text-subtle",
          main,
        )}
      >
        {p.loading ? (
          <Loader2 className={cn(mainIcon, "animate-spin")} />
        ) : p.playing ? (
          <Pause className={mainIcon} fill="currentColor" />
        ) : (
          <Play className={cn(mainIcon, "ml-0.5")} fill="currentColor" />
        )}
      </button>
      <button type="button" onClick={p.next} disabled={!p.hasNext} aria-label="Next" title="Next" className={cn(side, "text-muted hover:text-fg")}>
        <SkipForward className={icon} fill="currentColor" />
      </button>
      <button
        type="button"
        onClick={p.cycleRepeat}
        aria-label={p.repeat === "off" ? "Enable repeat" : p.repeat === "all" ? "Enable repeat one" : "Disable repeat"}
        title={p.repeat === "off" ? "Enable repeat" : p.repeat === "all" ? "Enable repeat one" : "Disable repeat"}
        className={cn(side, p.repeat !== "off" ? "text-accent" : "text-muted hover:text-fg")}
      >
        <RepeatIcon className={icon} />
        <ToggleDot on={p.repeat !== "off"} />
      </button>
    </div>
  );
}

export function ProgressBar({ className, large }: { className?: string; large?: boolean }) {
  const p = usePlayer();
  const canPlay = Boolean(p.track?.preview_url);
  const pct = p.duration ? (p.currentTime / p.duration) * 100 : 0;
  const slider = (
    <input
      type="range"
      className="range flex-1"
      min={0}
      max={p.duration || 1}
      step={0.1}
      value={Math.min(p.currentTime, p.duration || 1)}
      disabled={!canPlay}
      onChange={(e) => p.seek(Number(e.target.value))}
      style={{ "--fill": `${pct}%` } as CSSProperties}
      aria-label="Seek"
      aria-valuetext={`${fmtTime(p.currentTime)} of ${fmtTime(p.duration)}`}
    />
  );
  if (large) {
    return (
      <div className={className}>
        <div className="flex">{slider}</div>
        <div className="mt-1 flex justify-between text-xs tabular-nums text-muted">
          <span>{fmtTime(p.currentTime)}</span>
          <span>{fmtTime(p.duration)}</span>
        </div>
      </div>
    );
  }
  return (
    <div className={cn("flex items-center gap-2 text-[11px] tabular-nums text-subtle", className)}>
      <span className="w-9 text-right">{fmtTime(p.currentTime)}</span>
      {slider}
      <span className="w-9">{fmtTime(p.duration)}</span>
    </div>
  );
}

export function VolumeControl({ className }: { className?: string }) {
  const p = usePlayer();
  const vol = p.muted ? 0 : p.volume;
  const VolIcon = vol === 0 ? VolumeX : vol < 0.5 ? Volume1 : Volume2;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button type="button" onClick={p.toggleMute} aria-label={p.muted ? "Unmute" : "Mute"} className="text-muted hover:text-fg">
        <VolIcon className="h-4 w-4" />
      </button>
      <input
        type="range"
        className="range w-24"
        min={0}
        max={1}
        step={0.01}
        value={vol}
        onChange={(e) => p.setVolume(Number(e.target.value))}
        style={{ "--fill": `${vol * 100}%` } as CSSProperties}
        aria-label="Volume"
      />
    </div>
  );
}
