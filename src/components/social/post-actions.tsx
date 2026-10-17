"use client";

import { Heart, MessageCircle, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deletePost } from "@/lib/actions/posts";
import { setLike, setReaction } from "@/lib/actions/social";
import { REACTIONS } from "@/lib/constants";
import type { FeedPost, ReactionKey } from "@/lib/types";
import { cn, formatCompact } from "@/lib/utils";
import { CopyLinkButton } from "@/components/social/copy-link";

function useGate(signedIn: boolean) {
  const router = useRouter();
  return () => {
    if (signedIn) return true;
    router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
    return false;
  };
}

export function PostActions({ post, signedIn, isOwner }: { post: FeedPost; signedIn: boolean; isOwner: boolean }) {
  const gate = useGate(signedIn);
  const router = useRouter();
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likes, setLikes] = useState(post.like_count);
  const [reactions, setReactions] = useState(post.reactions);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const toggleLike = () => {
    if (!gate()) return;
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    start(async () => {
      const res = await setLike(post.id, next);
      if (!res.ok) {
        setLiked(!next);
        setLikes((n) => n + (next ? -1 : 1));
        setError(res.error);
      }
    });
  };

  const toggleReaction = (key: ReactionKey) => {
    if (!gate()) return;
    const cur = reactions.find((r) => r.emoji === key)!;
    const on = !cur.mine;
    const apply = (state: boolean) =>
      setReactions((rs) => rs.map((r) => (r.emoji === key ? { ...r, mine: state, count: r.count + (state ? 1 : -1) } : r)));
    apply(on);
    start(async () => {
      const res = await setReaction(post.id, key, on);
      if (!res.ok) {
        apply(!on);
        setError(res.error);
      }
    });
  };

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-1.5">
        {REACTIONS.map(({ key, emoji, label }) => {
          const r = reactions.find((x) => x.emoji === key)!;
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleReaction(key)}
              aria-pressed={r.mine}
              aria-label={`${label} (${r.count})`}
              title={label}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs tabular-nums transition-colors",
                r.mine ? "border-accent/60 bg-accent-soft text-fg" : "border-line text-muted hover:border-line-strong hover:text-fg",
                r.count === 0 && !r.mine && "max-sm:hidden",
              )}
            >
              <span aria-hidden>{emoji}</span>
              {r.count > 0 && r.count}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center gap-1 border-t border-line pt-2 -mx-1">
        <button
          type="button"
          onClick={toggleLike}
          aria-pressed={liked}
          aria-label={liked ? "Unlike" : "Like"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm tabular-nums transition-colors hover:bg-surface-2",
            liked ? "text-accent" : "text-muted hover:text-fg",
          )}
        >
          <Heart className="h-4 w-4" fill={liked ? "currentColor" : "none"} aria-hidden />
          {formatCompact(likes)}
        </button>
        <Link
          href={`/post/${post.id}#comments`}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm tabular-nums text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          aria-label={`${post.comment_count} comments`}
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          {formatCompact(post.comment_count)}
        </Link>
        <CopyLinkButton path={`/post/${post.id}`} label="Share" />
        {isOwner && (
          <div className="ml-auto flex items-center gap-1">
            {confirming ? (
              <>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() =>
                    startDelete(async () => {
                      const res = await deletePost(post.id);
                      if (res.ok) router.refresh();
                      else setError(res.error);
                      setConfirming(false);
                    })
                  }
                  className="rounded-full px-2.5 py-1.5 text-sm font-semibold text-down hover:bg-down/10"
                >
                  {deleting ? "Deleting…" : "Delete post"}
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="rounded-full px-2.5 py-1.5 text-sm text-muted hover:text-fg">
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                aria-label="Delete post"
                className="rounded-full p-2 text-subtle transition-colors hover:bg-surface-2 hover:text-down"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-down">
          {error}
        </p>
      )}
    </div>
  );
}
