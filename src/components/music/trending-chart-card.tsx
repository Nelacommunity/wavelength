import { TrendChart } from "@/components/charts/trend-chart";
import { QueueScope } from "@/components/player/queue-scope";
import { toPlayable } from "@/lib/playable";
import { DataSourceBadges } from "@/components/ui/badge";
import { Card } from "@/components/ui/misc";
import { TrendingRow } from "@/components/music/song-row";
import { getSongSeries, getTrending } from "@/lib/data/trending";
import type { Period } from "@/lib/types";
import { shortDateServer } from "@/components/charts/dates";

/** "Live-style" chart: ranking plus daily listener lines for the top 5. */
export async function TrendingChartCard({ period, country = null, genre = null }: { period: Period; country?: string | null; genre?: string | null }) {
  const { entries, hasDemo, hasLive, anchor } = await getTrending(period, country, genre, 5);
  if (entries.length === 0) {
    return <Card className="p-6 text-sm text-muted">No listening data for this selection yet.</Card>;
  }
  const days = period === "month" ? 30 : 14;
  const series = await getSongSeries(entries.map((e) => e.song.id), days, country);

  const label = `Trending ${period === "day" ? "today" : `this ${period}`}${genre ? ` · ${genre}` : ""}`;
  return (
    <QueueScope tracks={entries.map((e) => toPlayable(e.song))} label={label}>
    <Card className="grid gap-6 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">Daily listeners · top 5</h3>
            <p className="text-xs text-muted">Last {days} days through {shortDateServer(anchor)}</p>
          </div>
          <DataSourceBadges demo={hasDemo} live={hasLive} />
        </div>
        <TrendChart data={series} series={entries.map((e) => ({ key: e.song.id, label: e.song.title }))} />
      </div>
      <ol className="min-w-0 self-center">
        {entries.map((e) => (
          <TrendingRow key={e.song.id} entry={e} dense />
        ))}
      </ol>
    </Card>
    </QueueScope>
  );
}
