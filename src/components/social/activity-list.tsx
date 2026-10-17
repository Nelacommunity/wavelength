import Link from "next/link";
import { Heart, MessageCircle, Share2, Sparkles, UserPlus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Artwork } from "@/components/ui/artwork";
import { REACTIONS } from "@/lib/constants";
import type { ActivityItem } from "@/lib/data/activity";
import { displayName, timeAgo } from "@/lib/utils";

const ICONS = { like: Heart, comment: MessageCircle, follow: UserPlus, reaction: Sparkles, share: Share2, favorite: Heart };

function describe(i: ActivityItem, perspective: "notifications" | "feed") {
  const mine = perspective === "notifications";
  switch (i.kind) {
    case "like":
      return mine ? "liked your post" : "liked a post";
    case "comment":
      return "commented on your post";
    case "follow":
      return "started following you";
    case "reaction":
      return `reacted ${REACTIONS.find((r) => r.key === i.emoji)?.emoji ?? ""} to your post`;
    case "share":
      return "shared";
    case "favorite":
      return "added to favorites";
  }
}

export function ActivityList({ items, perspective }: { items: ActivityItem[]; perspective: "notifications" | "feed" }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((i) => {
        const Icon = ICONS[i.kind];
        const target = i.postId ? `/post/${i.postId}` : i.song ? `/song/${i.song.id}` : `/u/${i.actor.username}`;
        return (
          <li key={i.id} className="flex items-start gap-3 py-3.5">
            <div className="relative shrink-0">
              <Link href={`/u/${i.actor.username}`}>
                <Avatar user={i.actor} size={40} />
              </Link>
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-bg bg-surface-3 text-accent">
                <Icon className="h-2.5 w-2.5" aria-hidden />
              </span>
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <p>
                <Link href={`/u/${i.actor.username}`} className="font-semibold hover:underline">{displayName(i.actor)}</Link>{" "}
                <span className="text-muted">{describe(i, perspective)}</span>{" "}
                {i.song && (i.kind === "share" || i.kind === "favorite" || perspective === "feed") && (
                  <Link href={`/song/${i.song.id}`} className="font-medium hover:underline">{i.song.title}</Link>
                )}
                <span className="text-subtle"> · {timeAgo(i.at)}</span>
              </p>
              {i.text && <p className="mt-1 line-clamp-2 text-muted">“{i.text}”</p>}
            </div>
            {i.song && (
              <Link href={target} className="shrink-0" aria-label={`Open ${i.song.title}`}>
                <Artwork src={i.song.artwork_url} alt="" size={44} className="h-11 w-11" />
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
