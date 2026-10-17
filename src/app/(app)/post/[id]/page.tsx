import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleCheck } from "lucide-react";
import { WithRail } from "@/components/layout/right-rail";
import { PostCard } from "@/components/social/post-card";
import { CommentSection } from "@/components/social/comments";
import { getCurrentUser } from "@/lib/data/auth";
import { getComments, getPost } from "@/lib/data/feed";
import { displayName } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/post/[id]">): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return { title: "Post not found" };
  const title = `${displayName(post.user)} shared “${post.song.title}”`;
  return {
    title,
    description: post.caption || `${post.song.title} by ${post.song.artist}`,
    openGraph: { title, images: post.song.artwork_url ? [post.song.artwork_url] : [] },
  };
}

export default async function PostPage({ params, searchParams }: PageProps<"/post/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  const [post, comments] = await Promise.all([getPost(id, user?.id), getComments(id).catch(() => [])]);
  if (!post) notFound();

  return (
    <WithRail>
      <div className="max-w-2xl">
        <Link href="/#feed" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to feed
        </Link>
        {sp.shared === "1" && (
          <p role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-up/30 bg-up/10 px-4 py-3 text-sm text-up">
            <CircleCheck className="h-4 w-4" aria-hidden /> Your post is live. Copy the link to share it anywhere.
          </p>
        )}
        <PostCard post={post} viewerId={user?.id} />
        <CommentSection
          postId={post.id}
          initial={comments}
          viewer={
            user
              ? { id: user.id, username: user.profile.username, display_name: user.profile.display_name, avatar_url: user.profile.avatar_url, is_demo: user.profile.is_demo }
              : null
          }
        />
      </div>
    </WithRail>
  );
}
