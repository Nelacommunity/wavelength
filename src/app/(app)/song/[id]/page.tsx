import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Music2, SquarePen } from "lucide-react";
import { WithRail } from "@/components/layout/right-rail";
import { Artwork } from "@/components/ui/artwork";
import { ButtonLink } from "@/components/ui/button";
import { DataSourceBadges } from "@/components/ui/badge";
import { Card, EmptyState, SectionHeader, StatCard } from "@/components/ui/misc";
import { TrendIndicator } from "@/components/ui/trend";
import { SectionBoundary } from "@/components/ui/section-boundary";
import { ChartSkeleton, FeedSkeleton } from "@/components/ui/skeletons";
import { PlayButton } from "@/components/music/play-button";
import { toPlayable } from "@/lib/playable";
import { FavoriteButton } from "@/components/music/favorite-button";
import { ListenExternally } from "@/components/music/external-link";
import { CopyLinkButton } from "@/components/social/copy-link";
import { PostCard } from "@/components/social/post-card";
import { SongListenersChart } from "@/components/charts/growth-chart";
import { getCurrentUser } from "@/lib/data/auth";
import { getFavoriteSongIds, getSong } from "@/lib/data/songs";
import { getUploader } from "@/lib/data/albums";
import { OwnerDelete } from "@/components/music/owner-delete";
import { CoverEditor } from "@/components/music/cover-editor";
import { Avatar } from "@/components/ui/avatar";
import { getSongPopularity, getSongSeries } from "@/lib/data/trending";
import { getPostsForSong } from "@/lib/data/feed";
import { formatCompact, formatNumber } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/song/[id]">): Promise<Metadata> {
  const { id } = await params;
  const song = await getSong(id);
  if (!song) return { title: "Song not found" };
  return {
    title: `${song.title} · ${song.artist}`,
    description: `Listen to ${song.title} by ${song.artist} and see what people are saying on Wavelength.`,
    openGraph: { images: song.artwork_url ? [song.artwork_url] : [] },
  };
}

export default async function SongPage({ params }: PageProps<"/song/[id]">) {
  const { id } = await params;
  const [song, user] = await Promise.all([getSong(id), getCurrentUser()]);
  if (!song) notFound();
  const [favs, uploader] = await Promise.all([
    getFavoriteSongIds(user?.id, [song.id]),
    song.uploaded_by ? getUploader(song.uploaded_by) : Promise.resolve(null),
  ]);
  const isOwner = Boolean(user && song.uploaded_by === user.id);

  return (
    <WithRail>
      <section className="flex flex-col gap-6 sm:flex-row sm:items-end">
        {isOwner ? (
          <CoverEditor kind="song" id={song.id} userId={user!.id}>
            <Artwork src={song.artwork_url} alt={`${song.title} cover art`} size={240} priority className="w-48 shadow-2xl shadow-black/60 sm:w-60" rounded="rounded-xl" />
          </CoverEditor>
        ) : (
          <Artwork src={song.artwork_url} alt={`${song.title} cover art`} size={240} priority className="w-48 shadow-2xl shadow-black/60 sm:w-60" rounded="rounded-xl" />
        )}
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Song{song.genre ? ` · ${song.genre}` : ""}</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-5xl">{song.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-1 text-muted">
            {uploader ? (
              <Link href={`/u/${uploader.username}`} className="inline-flex items-center gap-2 font-semibold text-fg hover:underline">
                <Avatar user={uploader} size={24} />
                {song.artist}
              </Link>
            ) : (
              <Link href={`/discover?q=${encodeURIComponent(song.artist)}`} className="font-semibold text-fg hover:underline">{song.artist}</Link>
            )}
            {song.album && (
              <>
                {" "}·{" "}
                {song.album_id ? <Link href={`/album/${song.album_id}`} className="hover:underline">{song.album}</Link> : song.album}
              </>
            )}
            {song.release_date && <> · {song.release_date.slice(0, 4)}</>}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <PlayButton track={toPlayable(song)} size="lg" />
            <FavoriteButton songId={song.id} providerId={song.provider_id} initial={favs.has(song.id)} signedIn={Boolean(user)} withLabel className="h-10" />
            <ButtonLink href={`/share?song=${song.id}`} variant="secondary">
              <SquarePen className="h-4 w-4" aria-hidden /> Share
            </ButtonLink>
            <CopyLinkButton path={`/song/${song.id}`} iconOnly className="h-10 w-10 justify-center" />
            <ListenExternally song={song} />
            {isOwner && <OwnerDelete kind="song" id={song.id} redirectTo={uploader ? `/u/${uploader.username}?tab=music` : "/"} />}
          </div>
          {song.provider === "upload" && <p className="mt-3 text-xs text-subtle">Uploaded by the artist on Wavelength · full-length track</p>}
          {!song.preview_url && !song.audio_url && <p className="mt-3 text-xs text-subtle">No preview is available for this track — use the streaming link to listen.</p>}
        </div>
      </section>

      <div className="mt-10">
        <SectionBoundary label="Listener statistics">
          <Suspense fallback={<ChartSkeleton />}>
            <SongStats songId={song.id} />
          </Suspense>
        </SectionBoundary>
      </div>

      <section className="mt-10 max-w-2xl">
        <SectionHeader title="Shared by the community" />
        <SectionBoundary label="Posts">
          <Suspense fallback={<FeedSkeleton count={2} />}>
            <SongPosts songId={song.id} viewerId={user?.id} />
          </Suspense>
        </SectionBoundary>
      </section>
    </WithRail>
  );
}

async function SongStats({ songId }: { songId: string }) {
  const [pop, series] = await Promise.all([getSongPopularity(songId), getSongSeries([songId], 30)]);
  if (!pop) {
    return (
      <Card className="p-5 text-sm text-muted">
        No listener data yet. Stats appear here once people start listening to this song on Wavelength.
      </Card>
    );
  }
  const data = series.map((p) => ({ date: String(p.date), listeners: Number(p[songId] ?? 0) }));
  return (
    <section>
      <SectionHeader title="Listener statistics" subtitle="This week vs. last week" action={<DataSourceBadges demo={pop.isDemo} live={!pop.isDemo} />} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Popularity" value={`${Math.round(pop.score)}`} hint={`#${pop.rank} trending this week`} />
        <StatCard
          label="Listeners"
          value={formatCompact(pop.listeners)}
          hint={<TrendIndicator direction={pop.direction} changePct={pop.changePct} />}
        />
        <StatCard label="Plays" value={formatCompact(pop.plays)} hint={`${formatNumber(pop.plays)} total`} />
        <StatCard label="Likes · Shares" value={`${formatCompact(pop.likes)} · ${formatCompact(pop.shares)}`} />
      </div>
      <Card className="mt-4 p-4 sm:p-5">
        <h3 className="mb-3 text-sm font-semibold">Daily listeners · last 30 days</h3>
        <SongListenersChart data={data} />
      </Card>
    </section>
  );
}

async function SongPosts({ songId, viewerId }: { songId: string; viewerId?: string }) {
  const posts = await getPostsForSong(songId, viewerId);
  if (posts.length === 0) {
    return (
      <EmptyState
        icon={Music2}
        title="No one has shared this yet"
        body="Be the first to tell people why it's worth a listen."
        action={<ButtonLink href={`/share?song=${songId}`}>Share this song</ButtonLink>}
      />
    );
  }
  return (
    <div className="space-y-4">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} viewerId={viewerId} />
      ))}
    </div>
  );
}
