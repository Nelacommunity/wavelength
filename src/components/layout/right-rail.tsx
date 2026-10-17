import Link from "next/link";
import { QueueScope } from "@/components/player/queue-scope";
import { toPlayable } from "@/lib/playable";
import { Suspense, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { DemoBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/misc";
import { TrendingRow } from "@/components/music/song-row";
import { FollowButton } from "@/components/social/follow-button";
import { getTrending } from "@/lib/data/trending";
import { getSuggestedUsers } from "@/lib/data/profiles";
import { getCurrentUser } from "@/lib/data/auth";
import { displayName } from "@/lib/utils";

export function WithRail({ children, rail = <RightRail /> }: { children: ReactNode; rail?: ReactNode }) {
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">{children}</div>
      <aside className="hidden xl:block">
        <div className="sticky top-6 space-y-6">{rail}</div>
      </aside>
    </div>
  );
}

export function RightRail() {
  return (
    <>
      <Suspense fallback={<RailSkeleton />}>
        <PopularNow />
      </Suspense>
      <Suspense fallback={<RailSkeleton />}>
        <SuggestedUsers />
      </Suspense>
    </>
  );
}

function RailSkeleton() {
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <Skeleton className="h-5 w-32" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-11 w-11" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

async function PopularNow() {
  const { entries, hasDemo } = await getTrending("day", null, null, 5);
  return (
    <section className="rounded-2xl border border-line bg-surface p-3">
      <div className="flex items-center justify-between px-2 pb-1 pt-1">
        <h2 className="font-bold">Popular right now</h2>
        {hasDemo && <DemoBadge />}
      </div>
      {entries.length === 0 ? (
        <p className="px-2 py-4 text-sm text-muted">No listening data yet.</p>
      ) : (
        <QueueScope tracks={entries.map((e) => toPlayable(e.song))} label="Popular right now">
          <ol>
            {entries.map((e) => (
              <TrendingRow key={e.song.id} entry={e} dense />
            ))}
          </ol>
        </QueueScope>
      )}
      <Link href="/trending?period=day" className="block px-2 pb-1 pt-2 text-sm font-semibold text-muted hover:text-fg">
        See today&apos;s chart
      </Link>
    </section>
  );
}

async function SuggestedUsers() {
  const viewer = await getCurrentUser();
  const users = await getSuggestedUsers(viewer?.id, 4);
  if (users.length === 0) return null;
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-3 font-bold">Listeners to follow</h2>
      <ul className="space-y-3">
        {users.map((u) => (
          <li key={u.id} className="flex items-center gap-3">
            <Link href={`/u/${u.username}`} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar user={u} size={38} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{displayName(u)}</div>
                <div className="truncate text-xs text-muted">{u.posts} shares · @{u.username}</div>
              </div>
            </Link>
            <FollowButton userId={u.id} initial={false} signedIn={Boolean(viewer)} />
          </li>
        ))}
      </ul>
    </section>
  );
}
