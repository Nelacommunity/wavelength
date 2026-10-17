import Link from "next/link";
import { Artwork } from "@/components/ui/artwork";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PlayButton } from "@/components/music/play-button";
import { toPlayable } from "@/lib/playable";
import { ListenExternally } from "@/components/music/external-link";
import { PostActions } from "@/components/social/post-actions";
import type { FeedPost } from "@/lib/types";
import { displayName, timeAgo } from "@/lib/utils";

export function PostCard({ post, viewerId }: { post: FeedPost; viewerId?: string }) {
  const { user, song } = post;
  return (
    <article className="rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong sm:p-5">
      <header className="flex items-center gap-3">
        <Link href={`/u/${user.username}`} className="shrink-0">
          <Avatar user={user} size={40} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link href={`/u/${user.username}`} className="truncate font-semibold hover:underline">
              {displayName(user)}
            </Link>
            {user.is_demo && <Badge className="py-0">demo</Badge>}
          </div>
          <div className="text-xs text-muted">
            @{user.username} · <Link href={`/post/${post.id}`} className="hover:underline"><time dateTime={post.created_at}>{timeAgo(post.created_at)}</time></Link>
          </div>
        </div>
      </header>

      {post.caption && <p className="mt-3 whitespace-pre-line break-words text-[15px] leading-relaxed">{post.caption}</p>}

      {post.album ? (
        <div className="group mt-3 flex items-center gap-3 rounded-xl bg-surface-2 p-2.5 pr-3 transition-colors hover:bg-surface-3 sm:gap-4">
          <Artwork src={post.album.cover_url} alt={`${post.album.title} cover`} size={88} className="h-20 w-20 sm:h-[88px] sm:w-[88px]" rounded="rounded-lg" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-accent">Album</div>
            <Link href={`/album/${post.album.id}`} className="block truncate font-semibold hover:underline">
              {post.album.title}
            </Link>
            <div className="truncate text-sm text-muted">{song.artist}</div>
            <div className="mt-0.5 truncate text-xs text-subtle">
              {[post.album.genre, `${post.album.track_count} ${post.album.track_count === 1 ? "track" : "tracks"}`].filter(Boolean).join(" · ")}
            </div>
          </div>
          <PlayButton track={toPlayable(song)} />
        </div>
      ) : (
      <div className="group mt-3 flex items-center gap-3 rounded-xl bg-surface-2 p-2.5 pr-3 transition-colors hover:bg-surface-3 sm:gap-4">
        <Artwork src={song.artwork_url} alt={`${song.title} cover art`} size={72} className="h-16 w-16 sm:h-[72px] sm:w-[72px]" rounded="rounded-lg" />
        <div className="min-w-0 flex-1">
          <Link href={`/song/${song.id}`} className="block truncate font-semibold hover:underline">
            {song.title}
          </Link>
          <div className="truncate text-sm text-muted">{song.artist}</div>
          {song.genre && <div className="mt-0.5 truncate text-xs text-subtle">{song.genre}{song.album ? ` · ${song.album}` : ""}</div>}
        </div>
        <ListenExternally song={song} compact className="max-sm:hidden" />
        <PlayButton track={toPlayable(song)} />
      </div>
      )}

      <PostActions post={post} signedIn={Boolean(viewerId)} isOwner={viewerId === user.id} />
    </article>
  );
}
