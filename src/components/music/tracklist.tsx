import Link from "next/link";
import { Artwork } from "@/components/ui/artwork";
import { NowPlayingBars, PlayButton } from "@/components/music/play-button";
import { toPlayable } from "@/lib/playable";
import { FavoriteButton } from "@/components/music/favorite-button";
import { OwnerDelete } from "@/components/music/owner-delete";
import { CoverEditor } from "@/components/music/cover-editor";
import type { Song } from "@/lib/types";

function duration(ms: number | null) {
  if (!ms) return "";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function Tracklist({
  tracks,
  favorites,
  signedIn,
  isOwner,
  ownerId,
}: {
  tracks: Song[];
  favorites: Set<string>;
  signedIn: boolean;
  isOwner: boolean;
  /** Uploader's id; enables per-track cover editing. */
  ownerId?: string;
}) {
  return (
    <ol>
      {tracks.map((t, i) => (
        <li key={t.id} className="group grid grid-cols-[2rem_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2">
          <span className="text-center text-sm tabular-nums text-muted">{t.track_number ?? i + 1}</span>
          <div className="relative">
            <Artwork src={t.artwork_url} alt="" size={44} className="h-11 w-11" />

            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-black/50 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
              <PlayButton track={toPlayable(t)} size="sm" />
            </div>
          </div>
          <div className="min-w-0">
            <Link href={`/song/${t.id}`} className="flex items-center gap-2 truncate font-semibold hover:underline">
              <NowPlayingBars providerId={t.provider_id} />
              <span className="truncate">{t.title}</span>
            </Link>
            <div className="truncate text-sm text-muted">{t.artist}</div>
          </div>
          <div className="flex items-center gap-1">
            <span className="hidden w-10 text-right text-xs tabular-nums text-subtle sm:block">{duration(t.duration_ms)}</span>
            <FavoriteButton songId={t.id} providerId={t.provider_id} initial={favorites.has(t.id)} signedIn={signedIn} />
            {isOwner && ownerId && <CoverEditor kind="song" id={t.id} userId={ownerId} variant="button" />}
            {isOwner && <OwnerDelete kind="song" id={t.id} compact />}
          </div>
        </li>
      ))}
    </ol>
  );
}
