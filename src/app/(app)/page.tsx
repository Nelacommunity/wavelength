import Link from "next/link";
import { QueueScope } from "@/components/player/queue-scope";
import { toPlayable } from "@/lib/playable";
import { Suspense } from "react";
import { Flame, SquarePen } from "lucide-react";
import { WithRail } from "@/components/layout/right-rail";
import { Greeting } from "@/components/ui/greeting";
import { ButtonLink } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/badge";
import { SectionHeader, Segmented } from "@/components/ui/misc";
import { SectionBoundary } from "@/components/ui/section-boundary";
import { ChartSkeleton, FeedSkeleton, ShelfSkeleton } from "@/components/ui/skeletons";
import { Artwork } from "@/components/ui/artwork";
import { TrendIndicator } from "@/components/ui/trend";
import { SongCard, SongShelf } from "@/components/music/song-card";
import { TrendingChartCard } from "@/components/music/trending-chart-card";
import { FeedList } from "@/components/social/feed-list";
import { getCurrentUser } from "@/lib/data/auth";
import { getTopArtists, getTrending } from "@/lib/data/trending";
import { getRecentlySharedSongs } from "@/lib/data/feed";
import { getMostListened } from "@/lib/data/stats";
import { getNewAlbums, getLatestUploads } from "@/lib/data/discover";
import { PERIODS } from "@/lib/constants";
import type { Period } from "@/lib/types";
import { displayName, formatCompact, timeAgo } from "@/lib/utils";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const period: Period = PERIODS.some((p) => p.value === sp.period) ? (sp.period as Period) : "day";
  const feedScope = sp.feed === "following" ? "following" : "all";
  const user = await getCurrentUser();
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(sp.period ? { period: String(sp.period) } : {}), ...(sp.feed ? { feed: String(sp.feed) } : {}), ...patch });
    return `/?${p.toString()}`;
  };

  return (
    <WithRail>
      <div className="space-y-10">
        {user ? (
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Greeting name={displayName(user.profile)} />
              <p className="mt-1 text-muted">Here&apos;s what people are listening to and sharing.</p>
            </div>
            <ButtonLink href="/share" className="max-sm:hidden">
              <SquarePen className="h-4 w-4" aria-hidden /> Share a song
            </ButtonLink>
          </div>
        ) : (
          <section className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 sm:p-10">
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">Music is better together</p>
            <h1 className="mt-2 max-w-xl text-3xl font-bold tracking-tight sm:text-5xl">Find your wavelength.</h1>
            <p className="mt-3 max-w-lg text-muted sm:text-lg">
              Discover what&apos;s trending, share the songs you can&apos;t stop playing, and see what your friends have on repeat.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/signup" size="lg">Get started — it&apos;s free</ButtonLink>
              <ButtonLink href="/trending" size="lg" variant="outline">
                <Flame className="h-4 w-4" aria-hidden /> See what&apos;s trending
              </ButtonLink>
            </div>
          </section>
        )}

        <section>
          <SectionHeader title="New releases" subtitle="Fresh music uploaded on Wavelength" href="/discover" />
          <SectionBoundary label="New releases">
            <Suspense fallback={<ShelfSkeleton />}>
              <NewReleases />
            </Suspense>
          </SectionBoundary>
        </section>

        <section>
          <SectionHeader
            title="Trending now"
            subtitle="Ranked by listeners, growth, shares and likes"
            action={<Segmented items={PERIODS.map((p) => ({ href: qs({ period: p.value }), label: p.label, active: p.value === period }))} />}
            className="flex-wrap"
          />
          <SectionBoundary label="Trending chart">
            <Suspense key={period} fallback={<ChartSkeleton />}>
              <TrendingChartCard period={period} />
            </Suspense>
          </SectionBoundary>
          <div className="mt-4">
            <SectionBoundary label="Trending songs">
              <Suspense key={period} fallback={<ShelfSkeleton />}>
                <TrendingShelf period={period} />
              </Suspense>
            </SectionBoundary>
          </div>
        </section>

        <section>
          <SectionHeader title="Popular artists" subtitle="Most listeners this week" href="/stats" />
          <SectionBoundary label="Popular artists">
            <Suspense fallback={<ShelfSkeleton count={6} />}>
              <PopularArtists />
            </Suspense>
          </SectionBoundary>
        </section>

        <section>
          <SectionHeader title="Recently shared" subtitle="Fresh picks from the community" />
          <SectionBoundary label="Recently shared">
            <Suspense fallback={<ShelfSkeleton />}>
              <RecentlyShared />
            </Suspense>
          </SectionBoundary>
        </section>

        <section>
          <SectionHeader title="Popular with listeners" subtitle="Most-played songs this week" href="/trending?period=week" />
          <SectionBoundary label="Popular with listeners">
            <Suspense fallback={<ShelfSkeleton />}>
              <PopularWithListeners />
            </Suspense>
          </SectionBoundary>
        </section>

        <section id="feed">
          <SectionHeader
            title="Community feed"
            action={
              user ? (
                <Segmented
                  items={[
                    { href: `${qs({ feed: "all" })}#feed`, label: "Everyone", active: feedScope === "all" },
                    { href: `${qs({ feed: "following" })}#feed`, label: "Following", active: feedScope === "following" },
                  ]}
                />
              ) : undefined
            }
          />
          <div className="max-w-2xl">
            <SectionBoundary label="The feed">
              <Suspense key={feedScope} fallback={<FeedSkeleton />}>
                <FeedList viewerId={user?.id} scope={feedScope} />
              </Suspense>
            </SectionBoundary>
          </div>
        </section>
      </div>
    </WithRail>
  );
}

async function NewReleases() {
  const [albums, tracks] = await Promise.all([getNewAlbums({ limit: 5 }), getLatestUploads({ limit: 10 })]);
  const singles = tracks.filter((t) => !t.album_id).slice(0, Math.max(0, 5 - albums.length));
  if (albums.length === 0 && singles.length === 0) {
    return (
      <p className="text-sm text-muted">
        No music yet.{" "}
        <Link href="/upload" className="font-semibold text-fg hover:underline">
          Upload the first release
        </Link>
        .
      </p>
    );
  }
  return (
    <QueueScope tracks={singles.map(toPlayable)} label="New singles">
      <SongShelf>
        {albums.map((a) => (
          <Link key={a.id} href={`/album/${a.id}`} className="group rounded-xl p-2.5 transition-colors hover:bg-surface-2">
            <Artwork src={a.cover_url} alt={`${a.title} cover`} size={220} className="w-full shadow-lg shadow-black/30" />
            <div className="mt-2.5 truncate text-sm font-semibold">{a.title}</div>
            <div className="truncate text-xs text-muted">{a.artist ? displayName(a.artist) : ""}</div>
            <div className="mt-1 text-xs text-subtle">Album · {a.trackCount} {a.trackCount === 1 ? "track" : "tracks"}</div>
          </Link>
        ))}
        {singles.map((s) => (
          <SongCard key={s.id} song={s} meta="Single" />
        ))}
      </SongShelf>
    </QueueScope>
  );
}

async function TrendingShelf({ period }: { period: Period }) {
  const { entries } = await getTrending(period, null, null, 10);
  return (
    <QueueScope tracks={entries.slice(5, 10).map((e) => toPlayable(e.song))} label="Trending · more">
    <SongShelf>
      {entries.slice(5, 10).map((e) => (
        <SongCard
          key={e.song.id}
          song={e.song}
          meta={
            <span className="flex items-center gap-2">
              <span className="font-semibold text-muted">#{e.rank}</span>
              <span>{formatCompact(e.listeners)} listeners</span>
              <TrendIndicator direction={e.direction} changePct={e.changePct} compact />
            </span>
          }
        />
      ))}
    </SongShelf>
    </QueueScope>
  );
}

async function PopularArtists() {
  const artists = await getTopArtists("week", 6);
  return (
    <div className="scrollbar-none -mx-2 flex gap-2 overflow-x-auto sm:grid sm:grid-cols-3 sm:overflow-visible md:grid-cols-6">
      {artists.map((a) => (
        <Link
          key={a.artist}
          href={`/discover?q=${encodeURIComponent(a.artist)}`}
          className="group w-32 shrink-0 rounded-xl p-2 text-center transition-colors hover:bg-surface-2 sm:w-auto"
        >
          <Artwork src={a.artwork_url} alt="" size={160} rounded="rounded-full" className="mx-auto w-full shadow-lg shadow-black/30" />
          <div className="mt-2 truncate text-sm font-semibold">{a.artist}</div>
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted">
            {formatCompact(a.listeners)}
            {a.changePct !== null && (
              <TrendIndicator direction={a.changePct > 0.02 ? "up" : a.changePct < -0.02 ? "down" : "steady"} changePct={a.changePct} compact />
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

async function RecentlyShared() {
  const items = await getRecentlySharedSongs(5);
  if (items.length === 0) return <p className="text-sm text-muted">Nothing shared yet.</p>;
  return (
    <QueueScope tracks={items.map((i) => toPlayable(i.song))} label="Recently shared">
      <SongShelf>
        {items.map((i) => (
          <SongCard key={i.song.id} song={i.song} meta={`Shared by ${i.sharedBy} · ${timeAgo(i.at)}`} />
        ))}
      </SongShelf>
    </QueueScope>
  );
}

async function PopularWithListeners() {
  const top = await getMostListened("week", 5);
  return (
    <QueueScope tracks={top.map((e) => toPlayable(e.song))} label="Popular with listeners">
      <SongShelf>
        {top.map((e) => (
          <SongCard key={e.song.id} song={e.song} meta={`${formatCompact(e.plays)} plays`} />
        ))}
      </SongShelf>
      {top.some((e) => e.isDemo) && (
        <p className="mt-2 flex items-center gap-2 text-xs text-subtle">
          <DemoBadge /> Listener counts are simulated until real listening data is collected.
        </p>
      )}
    </QueueScope>
  );
}
