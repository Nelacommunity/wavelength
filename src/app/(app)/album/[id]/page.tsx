import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, Disc3, Plus, SquarePen } from "lucide-react";
import { WithRail } from "@/components/layout/right-rail";
import { Artwork } from "@/components/ui/artwork";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { toPlayable } from "@/lib/playable";
import { PlayAllButton, QueueScope, ShuffleButton } from "@/components/player/queue-scope";
import { Tracklist } from "@/components/music/tracklist";
import { OwnerDelete } from "@/components/music/owner-delete";
import { CoverEditor } from "@/components/music/cover-editor";
import { CopyLinkButton } from "@/components/social/copy-link";
import { getCurrentUser } from "@/lib/data/auth";
import { getAlbum } from "@/lib/data/albums";
import { getFavoriteSongIds } from "@/lib/data/songs";
import { displayName } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/album/[id]">): Promise<Metadata> {
  const { id } = await params;
  const album = await getAlbum(id);
  if (!album) return { title: "Album not found" };
  return {
    title: `${album.title} · ${displayName(album.artist)}`,
    description: album.description ?? `Album by ${displayName(album.artist)} on Wavelength`,
    openGraph: { images: album.cover_url ? [album.cover_url] : [] },
  };
}

export default async function AlbumPage({ params, searchParams }: PageProps<"/album/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const [album, user] = await Promise.all([getAlbum(id), getCurrentUser()]);
  if (!album) notFound();
  const isOwner = user?.id === album.user_id;
  const favorites = await getFavoriteSongIds(user?.id, album.tracks.map((t) => t.id));
  const totalMs = album.tracks.reduce((a, t) => a + (t.duration_ms ?? 0), 0);
  const first = album.tracks[0];

  return (
    <WithRail>
      <QueueScope tracks={album.tracks.map(toPlayable)} label={`Album · ${album.title}`}>
      {sp.new === "1" && (
        <p role="status" className="mb-6 flex items-center gap-2 rounded-xl border border-up/30 bg-up/10 px-4 py-3 text-sm text-up">
          <CircleCheck className="h-4 w-4" aria-hidden /> Your album is live. Share it with your followers!
        </p>
      )}
      {typeof sp.added === "string" && /^\d+$/.test(sp.added) && (
        <p role="status" className="mb-6 flex items-center gap-2 rounded-xl border border-up/30 bg-up/10 px-4 py-3 text-sm text-up">
          <CircleCheck className="h-4 w-4" aria-hidden /> Added {sp.added} {sp.added === "1" ? "track" : "tracks"} to this album.
        </p>
      )}
      <section className="flex flex-col gap-6 sm:flex-row sm:items-end">
        {isOwner ? (
          <CoverEditor kind="album" id={album.id} userId={user!.id}>
            <Artwork src={album.cover_url} alt={`${album.title} cover`} size={240} priority rounded="rounded-xl" className="w-48 shadow-2xl shadow-black/60 sm:w-60" />
          </CoverEditor>
        ) : (
          <Artwork src={album.cover_url} alt={`${album.title} cover`} size={240} priority rounded="rounded-xl" className="w-48 shadow-2xl shadow-black/60 sm:w-60" />
        )}
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Album{album.genre ? ` · ${album.genre}` : ""}</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-5xl">{album.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Link href={`/u/${album.artist.username}`} className="flex items-center gap-2 font-semibold text-fg hover:underline">
              <Avatar user={album.artist} size={24} />
              {displayName(album.artist)}
            </Link>
            {album.release_date && <span>· {album.release_date.slice(0, 4)}</span>}
            <span>· {album.tracks.length} {album.tracks.length === 1 ? "track" : "tracks"}</span>
            {totalMs > 0 && <span>· {Math.round(totalMs / 60000)} min</span>}
          </div>
          {album.description && <p className="mt-3 max-w-2xl whitespace-pre-line text-sm text-muted">{album.description}</p>}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <PlayAllButton />
            <ShuffleButton />
            {first && (
              <ButtonLink href={`/share?album=${album.id}`} variant="secondary">
                <SquarePen className="h-4 w-4" aria-hidden /> Share album
              </ButtonLink>
            )}
            <CopyLinkButton path={`/album/${album.id}`} title={`${album.title} by ${displayName(album.artist)}`} className="h-10 border border-line-strong px-4" />
            {isOwner && (
              <ButtonLink href={`/upload?album=${album.id}`} variant="outline">
                <Plus className="h-4 w-4" aria-hidden /> Add tracks
              </ButtonLink>
            )}
            {isOwner && <OwnerDelete kind="album" id={album.id} redirectTo={`/u/${album.artist.username}?tab=music`} />}
          </div>
        </div>
      </section>

      <section className="mt-10">
        {album.tracks.length === 0 ? (
          <EmptyState
            icon={Disc3}
            title="This album has no tracks yet"
            action={isOwner ? <ButtonLink href={`/upload?album=${album.id}`}>Add tracks</ButtonLink> : undefined}
          />
        ) : (
          <Tracklist tracks={album.tracks} favorites={favorites} signedIn={Boolean(user)} isOwner={isOwner} ownerId={isOwner ? user!.id : undefined} />
        )}
      </section>
      </QueueScope>
    </WithRail>
  );
}
