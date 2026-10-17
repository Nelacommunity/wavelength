import type { Metadata } from "next";
import { Suspense } from "react";
import { Bell, Users } from "lucide-react";
import { WithRail } from "@/components/layout/right-rail";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, Segmented } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { SectionBoundary } from "@/components/ui/section-boundary";
import { FeedSkeleton } from "@/components/ui/skeletons";
import { ActivityList } from "@/components/social/activity-list";
import { requireUser } from "@/lib/data/auth";
import { getFollowingActivity, getNotifications } from "@/lib/data/activity";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage({ searchParams }: PageProps<"/activity">) {
  const user = await requireUser("/activity");
  const sp = await searchParams;
  const tab = sp.tab === "following" ? "following" : "you";

  return (
    <WithRail>
      <PageHeader title="Activity" subtitle="Likes, comments and what the people you follow are listening to." />
      <Segmented
        className="mb-6"
        items={[
          { href: "/activity", label: "You", active: tab === "you" },
          { href: "/activity?tab=following", label: "Following", active: tab === "following" },
        ]}
      />
      <div className="max-w-2xl">
        <SectionBoundary label="Activity">
          <Suspense key={tab} fallback={<FeedSkeleton />}>
            {tab === "you" ? <Notifications userId={user.id} /> : <Following userId={user.id} />}
          </Suspense>
        </SectionBoundary>
      </div>
    </WithRail>
  );
}

async function Notifications({ userId }: { userId: string }) {
  const items = await getNotifications(userId);
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="Nothing here yet"
        body="When people like, react to or comment on your posts — or follow you — it shows up here."
        action={<ButtonLink href="/share">Share your first song</ButtonLink>}
      />
    );
  }
  return <ActivityList items={items} perspective="notifications" />;
}

async function Following({ userId }: { userId: string }) {
  const items = await getFollowingActivity(userId);
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No activity from people you follow"
        body="Follow listeners whose taste you like to see their shares and favorites here."
        action={<ButtonLink href="/" variant="secondary">Explore the feed</ButtonLink>}
      />
    );
  }
  return <ActivityList items={items} perspective="feed" />;
}
