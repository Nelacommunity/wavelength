import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Flame, Info } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { InsightsTabs } from "@/components/layout/insights-tabs";
import { Card, Chip, EmptyState, Segmented } from "@/components/ui/misc";
import { DataSourceBadges } from "@/components/ui/badge";
import { SectionBoundary } from "@/components/ui/section-boundary";
import { ChartSkeleton, RowsSkeleton } from "@/components/ui/skeletons";
import { TrendingRow } from "@/components/music/song-row";
import { PlayAllButton, QueueScope, ShuffleButton } from "@/components/player/queue-scope";
import { toPlayable } from "@/lib/playable";
import { TrendingChartCard } from "@/components/music/trending-chart-card";
import { shortDateServer } from "@/components/charts/dates";
import { getTrending } from "@/lib/data/trending";
import { COUNTRIES, GENRES, PERIODS, flag } from "@/lib/constants";
import { DEFAULT_WEIGHTS } from "@/lib/trending";
import type { Period } from "@/lib/types";

export const metadata: Metadata = { title: "Trending" };

export default async function TrendingPage({ searchParams }: PageProps<"/trending">) {
  const sp = await searchParams;
  const period: Period = PERIODS.some((p) => p.value === sp.period) ? (sp.period as Period) : "week";
  const country = typeof sp.country === "string" && sp.country in COUNTRIES ? sp.country : null;
  const genre = typeof sp.genre === "string" && (GENRES as readonly string[]).includes(sp.genre) ? sp.genre : null;

  const href = (patch: Record<string, string | null>) => {
    const base: Record<string, string | null> = { period, country, genre, ...patch };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(base)) if (v && !(k === "period" && v === "week")) p.set(k, v);
    const s = p.toString();
    return s ? `/trending?${s}` : "/trending";
  };
  const key = `${period}-${country}-${genre}`;

  return (
    <div>
      <PageHeader
        title="Trending"
        subtitle={`${country ? `${flag(country)} ${COUNTRIES[country]}` : "🌐 Global"}${genre ? ` · ${genre}` : ""} · ${PERIODS.find((p) => p.value === period)!.label}`}
        actions={<InsightsTabs active="trending" />}
      />

      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented items={PERIODS.map((p) => ({ href: href({ period: p.value }), label: p.label, active: p.value === period }))} />
          <RegionSelect current={country} hrefFor={(c) => href({ country: c })} />
        </div>
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          <Chip href={href({ genre: null })} active={!genre}>All genres</Chip>
          {GENRES.map((g) => (
            <Chip key={g} href={href({ genre: g })} active={genre === g}>{g}</Chip>
          ))}
        </div>
      </div>

      <SectionBoundary label="Trending chart">
        <Suspense key={key} fallback={<ChartSkeleton />}>
          <TrendingChartCard period={period} country={country} genre={genre} />
        </Suspense>
      </SectionBoundary>

      <div className="mt-8">
        <SectionBoundary label="Rankings">
          <Suspense key={key} fallback={<RowsSkeleton count={10} />}>
            <Rankings period={period} country={country} genre={genre} />
          </Suspense>
        </SectionBoundary>
      </div>

      <HowItWorks />
    </div>
  );
}

function RegionSelect({ current, hrefFor }: { current: string | null; hrefFor: (c: string | null) => string }) {
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-line-strong px-3.5 py-1.5 text-sm font-medium text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
        {current ? `${flag(current)} ${COUNTRIES[current]}` : "🌐 Global"}
        <span aria-hidden className="text-xs">▾</span>
      </summary>
      <div className="absolute left-0 z-30 mt-2 w-56 rounded-xl border border-line-strong bg-surface-2 p-1.5 shadow-2xl">
        <Link href={hrefFor(null)} scroll={false} className="block rounded-lg px-3 py-2 text-sm hover:bg-surface-3">🌐 Global</Link>
        {Object.entries(COUNTRIES).map(([code, name]) => (
          <Link key={code} href={hrefFor(code)} scroll={false} className="block rounded-lg px-3 py-2 text-sm hover:bg-surface-3" aria-current={current === code ? "true" : undefined}>
            {flag(code)} {name}
          </Link>
        ))}
      </div>
    </details>
  );
}

async function Rankings({ period, country, genre }: { period: Period; country: string | null; genre: string | null }) {
  const { entries, hasDemo, hasLive, start, end } = await getTrending(period, country, genre, 50);
  if (entries.length === 0) {
    return <EmptyState icon={Flame} title="Nothing trending here yet" body="Try another region, genre or time period." />;
  }
  const label = `Top ${entries.length} · ${country ? COUNTRIES[country] : "Global"}${genre ? ` · ${genre}` : ""}`;
  return (
    <QueueScope tracks={entries.map((e) => toPlayable(e.song))} label={label}>
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <PlayAllButton size="md" />
          <ShuffleButton />
          <h2 className="text-xl font-bold">Top {entries.length}</h2>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          {start === end ? shortDateServer(end) : `${shortDateServer(start)} – ${shortDateServer(end)}`}
          <DataSourceBadges demo={hasDemo} live={hasLive} />
        </div>
      </div>
      <div className="hidden grid-cols-[2.5rem_auto_minmax(0,1fr)_auto_auto] gap-4 border-b border-line px-2 pb-2 text-xs font-medium uppercase tracking-wider text-subtle sm:grid">
        <span className="text-center">#</span>
        <span className="w-[52px]" />
        <span>Title</span>
        <span className="hidden lg:block">Likes · Shares</span>
        <span className="text-right">Listeners · change</span>
      </div>
      <ol className="mt-1">
        {entries.map((e) => (
          <TrendingRow key={e.song.id} entry={e} />
        ))}
      </ol>
    </section>
    </QueueScope>
  );
}

function HowItWorks() {
  const w = DEFAULT_WEIGHTS;
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return (
    <Card className="mt-10 p-5 text-sm text-muted">
      <h2 className="mb-2 flex items-center gap-2 font-semibold text-fg">
        <Info className="h-4 w-4" aria-hidden /> How rankings work
      </h2>
      <p>
        Each song gets a trending score from unique listeners ({pct(w.listeners)}), plays ({pct(w.plays)}), listener growth vs the previous
        period ({pct(w.growth)}), shares ({pct(w.shares)}), likes ({pct(w.likes)}) and how recent the activity is ({pct(w.recency)}).
        Signals are normalized across all songs so they&apos;re compared fairly. Only verified listens count — a preview played for at least
        30 seconds — never page views or link clicks. Change percentages compare listeners with the previous period of equal length.
      </p>
    </Card>
  );
}
