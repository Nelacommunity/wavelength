import type { Metadata } from "next";
import { QueueScope } from "@/components/player/queue-scope";
import { toPlayable } from "@/lib/playable";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CalendarDays, Disc3, Heart, MapPin, Music2, Upload, Users } from "lucide-react";
import { WithRail } from "@/components/layout/right-rail";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, Segmented } from "@/components/ui/misc";
import { SectionBoundary } from "@/components/ui/section-boundary";
import { FeedSkeleton, ShelfSkeleton } from "@/components/ui/skeletons";
import { FollowButton } from "@/components/social/follow-button";
import { PostCard } from "@/components/social/post-card";
import { ActivityList } from "@/components/social/activity-list";
import { CopyLinkButton } from "@/components/social/copy-link";
import { SongCard, SongGrid } from "@/components/music/song-card";
import { getCurrentUser } from "@/lib/data/auth";
import { getFavorites, getFollowCounts, getFollowList, getProfileByUsername, getTopGenres } from "@/lib/data/profiles";
import { getPostsByUser } from "@/lib/data/feed";
import { getUsersActivity } from "@/lib/data/activity";
import { getUserMusic } from "@/lib/data/albums";
import { Artwork } from "@/components/ui/artwork";
import { COUNTRIES, flag } from "@/lib/constants";
import type { Profile } from "@/lib/types";
import { displayName, formatCompact } from "@/lib/utils";

const TABS = ["shares", "music", "favorites", "activity", "followers", "following"] as const;
type Tab = (typeof TABS)[number];

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfileByUsername(username);
  if (!profile) return { title: "Profile not found" };
  return { title: `${displayName(profile)} (@${profile.username})`, description: profile.bio ?? undefined };
}

export default async function ProfilePage({ params, searchParams }: PageProps<"/u/[username]">) {
  const { username } = await params;
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "shares";
  const [profile, viewer] = await Promise.all([getProfileByUsername(username), getCurrentUser()]);
  if (!profile) notFound();
  const isMe = viewer?.id === profile.id;
  const counts = await getFollowCounts(profile.id, viewer?.id);
  const base = `/u/${profile.username}`;

  return (
    <WithRail rail={<GenresCard userId={profile.id} />}>
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar user={profile} size={112} className="ring-4 ring-surface-2" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{displayName(profile)}</h1>
            {profile.is_demo && <Badge>demo account</Badge>}
          </div>
          <p className="text-muted">@{profile.username}</p>
          {profile.bio && <p className="mt-2 max-w-xl whitespace-pre-line break-words">{profile.bio}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <Link href={`${base}?tab=followers`} className="hover:text-fg">
              <span className="font-semibold text-fg tabular-nums">{formatCompact(counts.followers)}</span> followers
            </Link>
            <Link href={`${base}?tab=following`} className="hover:text-fg">
              <span className="font-semibold text-fg tabular-nums">{formatCompact(counts.following)}</span> following
            </Link>
            {profile.country && (
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden />{flag(profile.country)} {COUNTRIES[profile.country] ?? profile.country}</span>
            )}
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              Joined {new Date(profile.created_at).toLocaleDateString("en", { month: "long", year: "numeric" })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isMe ? (
            <ButtonLink href="/settings/profile" variant="outline">Edit profile</ButtonLink>
          ) : (
            <FollowButton userId={profile.id} initial={counts.isFollowing} signedIn={Boolean(viewer)} size="md" />
          )}
          <CopyLinkButton path={base} iconOnly className="h-10 w-10 justify-center border border-line-strong" />
        </div>
      </header>

      <div className="xl:hidden">
        <Suspense fallback={null}>
          <GenresCard userId={profile.id} className="mt-6" />
        </Suspense>
      </div>

      <Segmented
        className="mb-6 mt-8"
        items={[
          { href: base, label: "Shares", active: tab === "shares" },
          { href: `${base}?tab=music`, label: "Music", active: tab === "music" },
          { href: `${base}?tab=favorites`, label: "Favorites", active: tab === "favorites" },
          { href: `${base}?tab=activity`, label: "Activity", active: tab === "activity" },
          ...(tab === "followers" || tab === "following"
            ? [{ href: `${base}?tab=${tab}`, label: tab === "followers" ? "Followers" : "Following", active: true }]
            : []),
        ]}
      />

      <SectionBoundary label="This tab">
        <Suspense key={tab} fallback={tab === "favorites" ? <ShelfSkeleton count={8} /> : <FeedSkeleton />}>
          {tab === "shares" && <Shares profile={profile} viewerId={viewer?.id} isMe={isMe} />}
          {tab === "music" && <UploadedMusic profile={profile} isMe={isMe} />}
          {tab === "favorites" && <Favorites profile={profile} />}
          {tab === "activity" && <UserActivity profile={profile} />}
          {(tab === "followers" || tab === "following") && <FollowList profile={profile} kind={tab} />}
        </Suspense>
      </SectionBoundary>
    </WithRail>
  );
}

async function GenresCard({ userId, className }: { userId: string; className?: string }) {
  const genres = await getTopGenres(userId);
  if (genres.length === 0) return null;
  return (
    <Card className={`p-4 ${className ?? ""}`}>
      <h2 className="mb-3 font-bold">Most-listened genres</h2>
      <ul className="space-y-2.5">
        {genres.map((g) => (
          <li key={g.genre}>
            <div className="mb-1 flex justify-between text-sm">
              <span>{g.genre}</span>
              <span className="tabular-nums text-muted">{Math.round(g.share * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-accent" style={{ width: `${g.share * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-subtle">Based on favorites and shared songs.</p>
    </Card>
  );
}

async function Shares({ profile, viewerId, isMe }: { profile: Profile; viewerId?: string; isMe: boolean }) {
  const posts = await getPostsByUser(profile.id, viewerId);
  if (posts.length === 0) {
    return (
      <EmptyState
        icon={Music2}
        title={isMe ? "You haven't shared anything yet" : "No shares yet"}
        body={isMe ? "Share a song you love — your followers will see it in their feed." : undefined}
        action={isMe ? <ButtonLink href="/share">Share a song</ButtonLink> : undefined}
      />
    );
  }
  return (
    <QueueScope tracks={posts.map((p) => toPlayable(p.song))} label={`Shares · ${displayName(profile)}`}>
      <div className="max-w-2xl space-y-4">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} viewerId={viewerId} />
        ))}
      </div>
    </QueueScope>
  );
}

async function UploadedMusic({ profile, isMe }: { profile: Profile; isMe: boolean }) {
  const { albums, singles } = await getUserMusic(profile.id);
  if (albums.length === 0 && singles.length === 0) {
    return (
      <EmptyState
        icon={Disc3}
        title={isMe ? "You haven't uploaded any music yet" : "No uploaded music yet"}
        body={isMe ? "Release a single or a full album with your own cover art." : undefined}
        action={isMe ? <ButtonLink href="/upload"><Upload className="h-4 w-4" aria-hidden /> Upload music</ButtonLink> : undefined}
      />
    );
  }
  return (
    <div className="space-y-8">
      {isMe && (
        <ButtonLink href="/upload" variant="secondary">
          <Upload className="h-4 w-4" aria-hidden /> Upload more
        </ButtonLink>
      )}
      {albums.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Albums</h2>
          <SongGrid>
            {albums.map((a) => (
              <Link key={a.id} href={`/album/${a.id}`} className="group rounded-xl p-2.5 transition-colors hover:bg-surface-2">
                <Artwork src={a.cover_url} alt={`${a.title} cover`} size={220} className="w-full shadow-lg shadow-black/30" />
                <div className="mt-2.5 truncate text-sm font-semibold">{a.title}</div>
                <div className="truncate text-xs text-muted">
                  {[a.release_date?.slice(0, 4), `${a.trackCount} ${a.trackCount === 1 ? "track" : "tracks"}`].filter(Boolean).join(" · ")}
                </div>
              </Link>
            ))}
          </SongGrid>
        </section>
      )}
      {singles.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Singles</h2>
          <QueueScope tracks={singles.map(toPlayable)} label={`Singles · ${displayName(profile)}`}>
            <SongGrid>
              {singles.map((s) => (
                <SongCard key={s.id} song={s} meta={s.genre ?? undefined} />
              ))}
            </SongGrid>
          </QueueScope>
        </section>
      )}
    </div>
  );
}

async function Favorites({ profile }: { profile: Profile }) {
  const songs = await getFavorites(profile.id);
  if (songs.length === 0) return <EmptyState icon={Heart} title="No favorite tracks yet" body="Tap the heart on any song to save it here." />;
  return (
    <QueueScope tracks={songs.map(toPlayable)} label={`Favorites · ${displayName(profile)}`}>
      <SongGrid>
        {songs.map((s) => (
          <SongCard key={s.id} song={s} />
        ))}
      </SongGrid>
    </QueueScope>
  );
}

async function UserActivity({ profile }: { profile: Profile }) {
  const items = await getUsersActivity([profile.id], 30);
  if (items.length === 0) return <EmptyState icon={Music2} title="No activity yet" />;
  return (
    <div className="max-w-2xl">
      <ActivityList items={items} perspective="feed" />
    </div>
  );
}

async function FollowList({ profile, kind }: { profile: Profile; kind: "followers" | "following" }) {
  const users = await getFollowList(profile.id, kind);
  if (users.length === 0) {
    return <EmptyState icon={Users} title={kind === "followers" ? "No followers yet" : "Not following anyone yet"} />;
  }
  return (
    <ul className="grid max-w-2xl gap-2 sm:grid-cols-2">
      {users.map((u) => (
        <li key={u.id}>
          <Link href={`/u/${u.username}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 hover:bg-surface-2">
            <Avatar user={u} size={40} />
            <div className="min-w-0">
              <div className="truncate font-semibold">{displayName(u)}</div>
              <div className="truncate text-sm text-muted">@{u.username}</div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
