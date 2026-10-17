import { Music2 } from "lucide-react";
import { QueueScope } from "@/components/player/queue-scope";
import { toPlayable } from "@/lib/playable";
import { PostCard } from "@/components/social/post-card";
import { EmptyState } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { NewPostsPill } from "@/components/social/new-posts-pill";
import { getFeed } from "@/lib/data/feed";

export async function FeedList({ viewerId, scope }: { viewerId?: string; scope: "all" | "following" }) {
  const posts = await getFeed({ viewerId, scope, limit: 20 });
  if (posts.length === 0) {
    return scope === "following" ? (
      <EmptyState
        icon={Music2}
        title="Your following feed is quiet"
        body="Follow a few listeners to see what they're sharing here."
        action={<ButtonLink href="/discover" variant="secondary">Find people & music</ButtonLink>}
      />
    ) : (
      <EmptyState
        icon={Music2}
        title="No posts yet"
        body="Be the first to share a song with the community."
        action={<ButtonLink href="/share">Share a song</ButtonLink>}
      />
    );
  }
  return (
    <QueueScope tracks={posts.map((p) => toPlayable(p.song))} label={scope === "following" ? "Following feed" : "Community feed"}>
    <div className="space-y-4">
      <NewPostsPill since={posts[0]?.created_at} />
      {posts.map((p) => (
        <PostCard key={p.id} post={p} viewerId={viewerId} />
      ))}
    </div>
    </QueueScope>
  );
}
