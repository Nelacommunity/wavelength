import Link from "next/link";
import type { ReactNode } from "react";
import { Artwork } from "@/components/ui/artwork";
import { PlayButton } from "@/components/music/play-button";
import { toPlayable } from "@/lib/playable";
import type { CatalogTrack, Song } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SongCard({
  song,
  meta,
  className,
  priority,
}: {
  song: Song | CatalogTrack;
  meta?: ReactNode;
  className?: string;
  priority?: boolean;
}) {
  const href = song.id ? `/song/${song.id}` : (song.external_url ?? "#");
  const external = !song.id;
  return (
    <div className={cn("group relative rounded-xl p-2.5 transition-colors hover:bg-surface-2", className)}>
      <div className="relative">
        <Artwork src={song.artwork_url} alt={`${song.title} cover art`} size={220} className="w-full shadow-lg shadow-black/30" priority={priority} />
        <div className="absolute bottom-2 right-2 z-10 translate-y-1 opacity-0 transition-all duration-200 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100 max-lg:translate-y-0 max-lg:opacity-100">
          <PlayButton track={toPlayable(song)} />
        </div>
      </div>
      <Link
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className="mt-2.5 block truncate text-sm font-semibold after:absolute after:inset-0 after:content-['']"
      >
        {song.title}
      </Link>
      <div className="truncate text-xs text-muted">{song.artist}</div>
      {meta && <div className="mt-1 text-xs text-subtle">{meta}</div>}
    </div>
  );
}

export function SongGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5", className)}>{children}</div>
  );
}

/** Horizontal scroller on mobile, grid on larger screens. */
export function SongShelf({ children }: { children: ReactNode }) {
  return (
    <div className="scrollbar-none -mx-2.5 flex snap-x gap-1 overflow-x-auto sm:grid sm:grid-cols-3 sm:overflow-visible md:grid-cols-4 2xl:grid-cols-5 [&>*]:w-40 [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-auto">
      {children}
    </div>
  );
}
