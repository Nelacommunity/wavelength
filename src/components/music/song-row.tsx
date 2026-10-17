import Link from "next/link";
import { Heart, Share2 } from "lucide-react";
import { Artwork } from "@/components/ui/artwork";
import { TrendIndicator } from "@/components/ui/trend";
import { NowPlayingBars, PlayButton } from "@/components/music/play-button";
import { toPlayable } from "@/lib/playable";
import type { TrendingEntry } from "@/lib/types";
import { cn, formatCompact, formatNumber } from "@/lib/utils";

export function TrendingRow({ entry, dense }: { entry: TrendingEntry; dense?: boolean }) {
  const { song } = entry;
  return (
    <li className="group relative grid grid-cols-[2rem_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2 sm:grid-cols-[2.5rem_auto_minmax(0,1fr)_auto_auto] md:gap-4">
      <span className={cn("text-center font-bold tabular-nums", entry.rank <= 3 ? "text-lg text-fg" : "text-base text-muted")}>{entry.rank}</span>
      <div className="relative">
        <Artwork src={song.artwork_url} alt="" size={dense ? 44 : 52} className={dense ? "h-11 w-11" : "h-[52px] w-[52px]"} />
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-black/50 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <PlayButton track={toPlayable(song)} size="sm" />
        </div>
      </div>
      <div className="min-w-0">
        <Link href={`/song/${song.id}`} className="flex items-center gap-2 truncate font-semibold after:absolute after:inset-0 after:content-['']">
          <NowPlayingBars providerId={song.provider_id} />
          <span className="truncate">{song.title}</span>
        </Link>
        <div className="truncate text-sm text-muted">
          {song.artist}
          {!dense && song.genre && <span className="hidden text-subtle sm:inline"> · {song.genre}</span>}
        </div>
      </div>
      {!dense && (
        <div className="hidden items-center gap-4 text-xs tabular-nums text-muted sm:flex">
          <span className="hidden items-center gap-1 lg:flex" title={`${formatNumber(entry.likes)} likes`}>
            <Heart className="h-3.5 w-3.5" aria-hidden /> {formatCompact(entry.likes)}
          </span>
          <span className="hidden items-center gap-1 lg:flex" title={`${formatNumber(entry.shares)} shares`}>
            <Share2 className="h-3.5 w-3.5" aria-hidden /> {formatCompact(entry.shares)}
          </span>
        </div>
      )}
      <div className="flex flex-col items-end gap-0.5 text-right">
        <span className="text-sm font-semibold tabular-nums" title={`${formatNumber(entry.listeners)} listeners`}>
          {formatCompact(entry.listeners)}
          <span className="ml-1 hidden text-xs font-normal text-subtle md:inline">listeners</span>
        </span>
        <TrendIndicator direction={entry.direction} changePct={entry.changePct} compact={dense} />
      </div>
    </li>
  );
}
