import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Activity, Headphones, Radio, Share2, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { InsightsTabs } from "@/components/layout/insights-tabs";
import { Card, SectionHeader, Skeleton, StatCard } from "@/components/ui/misc";
import { DataSourceBadges, DemoBadge, LiveBadge } from "@/components/ui/badge";
import { SectionBoundary } from "@/components/ui/section-boundary";
import { ChartSkeleton } from "@/components/ui/skeletons";
import { Artwork } from "@/components/ui/artwork";
import { ListenerGrowthChart, SharesChart } from "@/components/charts/growth-chart";
import { BarList } from "@/components/charts/bar-list";
import { shortDateServer } from "@/components/charts/dates";
import { getCountryStats, getLiveCounts, getMostListened, getPlatformSeries } from "@/lib/data/stats";
import { getTopArtists, getTrending } from "@/lib/data/trending";
import { COUNTRIES, flag } from "@/lib/constants";
import { formatCompact, formatNumber, formatPct } from "@/lib/utils";

export const metadata: Metadata = { title: "Listener statistics" };

export default function StatsPage() {
  return (
    <div className="space-y-10">
      <PageHeader title="Listener statistics" subtitle="How the Wavelength community listens and shares" actions={<InsightsTabs active="stats" />} />

      <SectionBoundary label="Platform overview">
        <Suspense fallback={<CardsSkeleton />}>
          <Overview />
        </Suspense>
      </SectionBoundary>

      <SectionBoundary label="Live activity">
        <Suspense fallback={<Skeleton className="h-28 w-full rounded-2xl" />}>
          <LiveActivity />
        </Suspense>
      </SectionBoundary>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionBoundary label="Most-listened songs">
          <Suspense fallback={<ChartSkeleton />}>
            <MostListened />
          </Suspense>
        </SectionBoundary>
        <SectionBoundary label="Popular artists">
          <Suspense fallback={<ChartSkeleton />}>
            <TopArtists />
          </Suspense>
        </SectionBoundary>
      </div>

      <SectionBoundary label="Trending by country">
        <Suspense fallback={<ChartSkeleton />}>
          <ByCountry />
        </Suspense>
      </SectionBoundary>
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <ChartSkeleton />
    </div>
  );
}

async function Overview() {
  const { points, anchor } = await getPlatformSeries(90);
  if (points.length === 0) {
    return <Card className="p-6 text-sm text-muted">No platform statistics yet. They appear once the daily stats job has run.</Card>;
  }
  const last = points[points.length - 1];
  const weekAgo = points[points.length - 8] ?? points[0];
  const monthAgo = points[points.length - 31] ?? points[0];
  const shares30 = points.slice(-30).reduce((a, p) => a + p.shares, 0);
  const sharesPrev30 = points.slice(-60, -30).reduce((a, p) => a + p.shares, 0);
  const demo = points.some((p) => p.demo);
  const badge = demo ? <DemoBadge label="Demo" /> : <LiveBadge />;

  return (
    <section className="space-y-6">
      {demo && (
        <p className="flex flex-wrap items-center gap-2 rounded-xl border border-warn/30 bg-warn/5 px-4 py-3 text-sm text-muted">
          <DemoBadge />
          Platform-wide numbers below are simulated seed data for this MVP. Real activity is shown separately under “Live activity”.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total listeners"
          icon={Users}
          value={formatCompact(last.total)}
          hint={`${formatPct((last.total - monthAgo.total) / Math.max(1, monthAgo.total))} in 30 days`}
          badge={badge}
        />
        <StatCard
          label="Active listeners"
          icon={Activity}
          value={formatCompact(last.active)}
          hint={`${formatPct((last.active - weekAgo.active) / Math.max(1, weekAgo.active))} vs a week ago`}
          badge={badge}
        />
        <StatCard label="New listeners" icon={Headphones} value={formatCompact(last.newListeners)} hint={`on ${shortDateServer(anchor)}`} badge={badge} />
        <StatCard
          label="Songs shared · 30d"
          icon={Share2}
          value={formatCompact(shares30)}
          hint={`${formatPct((shares30 - sharesPrev30) / Math.max(1, sharesPrev30))} vs previous 30 days`}
          badge={badge}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="p-4 sm:p-5">
          <SectionHeader title="Listener growth" subtitle={`Last 90 days through ${shortDateServer(anchor)}`} className="mb-2" />
          <ListenerGrowthChart data={points} />
        </Card>
        <Card className="p-4 sm:p-5">
          <SectionHeader title="Sharing activity" subtitle="Songs shared per day · last 30 days" className="mb-4" />
          <SharesChart data={points.slice(-30)} height={260} />
        </Card>
      </div>
    </section>
  );
}

async function LiveActivity() {
  const c = await getLiveCounts();
  const items = [
    { label: "Members", value: c.profiles },
    { label: "Posts", value: c.posts },
    { label: "Likes", value: c.likes },
    { label: "Comments", value: c.comments },
    { label: "Verified listens", value: c.listens },
    { label: "Unique listeners", value: c.listeners },
  ];
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Radio className="h-5 w-5 text-up" aria-hidden /> Live activity
          </h2>
          <p className="text-sm text-muted">Real numbers from real accounts — demo users excluded.</p>
        </div>
        <LiveBadge />
      </div>
      <dl className="grid grid-cols-3 gap-4 sm:grid-cols-6">
        {items.map((i) => (
          <div key={i.label}>
            <dt className="text-xs text-muted">{i.label}</dt>
            <dd className="text-xl font-bold tabular-nums">{formatNumber(i.value)}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

async function MostListened() {
  const top = await getMostListened("week", 8);
  return (
    <Card className="h-full p-4 sm:p-5">
      <SectionHeader title="Most-listened songs" subtitle="Listeners this week" action={<DataSourceBadges demo={top.some((t) => t.isDemo)} live={!top.some((t) => t.isDemo)} />} />
      <BarList
        items={top.map((t) => ({
          key: t.song.id,
          value: t.listeners,
          label: (
            <Link href={`/song/${t.song.id}`} className="flex min-w-0 items-center gap-2 hover:underline">
              <Artwork src={t.song.artwork_url} alt="" size={28} className="h-7 w-7" rounded="rounded" />
              <span className="truncate">
                {t.song.title} <span className="text-muted">· {t.song.artist}</span>
              </span>
            </Link>
          ),
        }))}
      />
    </Card>
  );
}

async function TopArtists() {
  const [artists, { hasDemo, hasLive }] = await Promise.all([getTopArtists("week", 8), getTrending("week", null, null, 200)]);
  return (
    <Card className="h-full p-4 sm:p-5">
      <SectionHeader title="Most popular artists" subtitle="Listeners this week" action={<DataSourceBadges demo={hasDemo} live={hasLive} />} />
      <BarList
        items={artists.map((a) => ({
          key: a.artist,
          value: a.listeners,
          extra: <span className="text-xs">{formatPct(a.changePct)}</span>,
          label: (
            <Link href={`/discover?q=${encodeURIComponent(a.artist)}`} className="flex min-w-0 items-center gap-2 hover:underline">
              <Artwork src={a.artwork_url} alt="" size={28} className="h-7 w-7" rounded="rounded-full" />
              <span className="truncate">{a.artist}</span>
            </Link>
          ),
        }))}
      />
    </Card>
  );
}

async function ByCountry() {
  const [rows, { hasDemo, hasLive }] = await Promise.all([getCountryStats(7), getTrending("week", null, null, 200)]);
  return (
    <section>
      <SectionHeader title="Trending by country" subtitle="Top song and listeners per country · this week" action={<DataSourceBadges demo={hasDemo} live={hasLive} />} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {rows.map((r) => (
          <Link
            key={r.country}
            href={`/trending?country=${r.country}`}
            className="group rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-surface-2"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">
                {flag(r.country)} {COUNTRIES[r.country] ?? r.country}
              </span>
              <span className="text-xs tabular-nums text-muted">{formatCompact(r.listeners)} listeners</span>
            </div>
            {r.top?.song && (
              <div className="mt-3 flex items-center gap-3">
                <Artwork src={r.top.song.artwork_url} alt="" size={44} className="h-11 w-11" />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-accent">#1</div>
                  <div className="truncate text-sm font-semibold">{r.top.song.title}</div>
                  <div className="truncate text-xs text-muted">{r.top.song.artist}</div>
                </div>
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
