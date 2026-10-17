"use client";

import Link from "next/link";
import { Loader2, MessageCircle, Send, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { addComment, deleteComment } from "@/lib/actions/social";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import type { Comment, ProfileSummary } from "@/lib/types";
import { displayName, timeAgo } from "@/lib/utils";

export function CommentSection({
  postId,
  initial,
  viewer,
}: {
  postId: string;
  initial: Comment[];
  viewer: ProfileSummary | null;
}) {
  const [comments, setComments] = useState(initial);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const text = body.trim();
    if (!text) return;
    start(async () => {
      const res = await addComment(postId, text);
      if (res.ok && res.data) {
        setComments((c) => [...c, res.data!]);
        setBody("");
        setError(null);
      } else if (!res.ok) setError(res.error);
    });
  };

  return (
    <section id="comments" className="mt-6">
      <h2 className="mb-3 text-lg font-bold">Comments {comments.length > 0 && <span className="text-muted">· {comments.length}</span>}</h2>

      {viewer ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-start gap-3"
        >
          <Avatar user={viewer} size={36} />
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
              }}
              maxLength={500}
              rows={2}
              placeholder="Add a comment…"
              aria-label="Comment"
              className="w-full resize-none rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm placeholder:text-subtle focus:border-accent focus:outline-none"
            />
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-xs text-subtle">{body.length}/500</span>
              <button
                type="submit"
                disabled={pending || !body.trim()}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-3.5 text-sm font-semibold text-black disabled:opacity-40"
              >
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Post
              </button>
            </div>
            {error && <p role="alert" className="mt-1 text-xs text-down">{error}</p>}
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 p-4 text-sm text-muted">
          Log in to join the conversation.
          <ButtonLink href={`/login?next=/post/${postId}`} size="sm">Log in</ButtonLink>
        </div>
      )}

      {comments.length === 0 ? (
        <div className="mt-6 flex flex-col items-center py-8 text-center text-sm text-muted">
          <MessageCircle className="mb-2 h-5 w-5 text-subtle" aria-hidden />
          No comments yet. Start the conversation.
        </div>
      ) : (
        <ul className="mt-5 space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="group flex gap-3">
              <Link href={`/u/${c.user.username}`}>
                <Avatar user={c.user} size={36} />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <Link href={`/u/${c.user.username}`} className="font-semibold hover:underline">{displayName(c.user)}</Link>
                  <span className="text-xs text-subtle">{timeAgo(c.created_at)}</span>
                  {viewer?.id === c.user.id && (
                    <button
                      type="button"
                      aria-label="Delete comment"
                      onClick={() =>
                        start(async () => {
                          const res = await deleteComment(c.id);
                          if (res.ok) setComments((cs) => cs.filter((x) => x.id !== c.id));
                          else setError(res.error);
                        })
                      }
                      className="ml-auto rounded-full p-1 text-subtle opacity-0 transition-opacity hover:text-down group-hover:opacity-100 focus:opacity-100 max-lg:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-line break-words text-sm leading-relaxed">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
