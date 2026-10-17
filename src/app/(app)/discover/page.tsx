import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Disc3, MicVocal, Music2, SearchX, Upload } from "lucide-react";
import { WithRail } from "@/components/layout/right-rail";
import { PageHeader } from "@/components/layout/page-header";
import { Chip, EmptyState, SectionHeader, Segmented } from "@/components/ui/misc";
import { SectionBoundary } from "@/components/ui/section-boundary";
import { RowsSkeleton, ShelfSkeleton } from "@/components/ui/skeletons";
import { Artwork } from "@/components/ui/artwork";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { SearchBox } from "@/components/music/search-box";
import { SongGrid } from "@/components/music/song-card";
import { Tracklist } from "@/components/music/tracklist";
import { QueueScope } from "@/components/player/queue-scope";
import { getCurrentUser } from "@/lib/data/auth";
import { getFavoriteSongIds, searchLocalSongs } from "@/lib/data/songs";
import { getLatestUploads, getNewAlbums, getUploadArtists, searchAlbums, searchArtists, type AlbumCard, type ArtistCard } from "@/lib/data/discover";
import { toPlayable } from "@/lib/playable";
import { GENRES } from "@/lib/constants";
import { displayName } from "@/lib/utils";

export const metadata: Metadata = { title: "Discover" };

const TYPES = [
  { value: "songs", label: "Songs" },
  { value: "albums", label: "Albums" },
  { value: "artists", label: "Artists" },
] as const;
type SearchType = (typeof TYPES)[number]["value"];

export default async function DiscoverPage({ searchParams }: PageProps<"/discover">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const type: SearchType = TYPES.some((t) => t.value === sp.type) ? (sp.type as SearchType) : "songs";
  const genre = typeof sp.genre === "string" && (GENRES as readonly string[]).includes(sp.genre) ? sp.genre : null;

  return (
    <WithRail>
      <PageHeader title="Discover" subtitle="New music uploaded by artists on Wavelength." />
      <div className="mb-6 max-w-2xl">
        <SearchBox defaultValue={q} type={type} />
      </div>

      {q ? (
        <>
          <Segmented
            className="mb-6"
            items={TYPES.map((t) => ({ href: `/discover?q=${encodeURIComponent(q)}${t.value === "songs" ? "" : `&type=${t.value}`}`, label: t.label, active: t.value === type }))}
          />
          <SectionBoundary label="Search results">
            <Suspense key={`${q}-${type}`} fallback={<RowsSkeleton count={8} />}>
              {type === "songs" && <SongResults q={q} />}
              {type === "albums" && <AlbumResults q={q} />}
              {type === "artists" && <ArtistResults q={q} />}
            </Suspense>
          </SectionBoundary>
        </>
      ) : (
        <div className="space-y-10">
          <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            <Chip href="/discover" active={!genre}>All</Chip>
            {GENRES.map((g) => (
              <Chip key={g} href={`/discover?genre=${encodeURIComponent(g)}`} active={genre === g}>{g}</Chip>
            ))}
          </div>
          <SectionBoundary label="Discover">
            <Suspense key={genre ?? "all"} fallback={<ShelfSkeleton count={10} />}>
              <Browse genre={genre} />
            </Suspense>
          </SectionBoundary>
        </div>
      )}
    </WithRail>
  );
}

function AlbumGrid({ albums }: { albums: AlbumCard[] }) {
  return (
    <SongGrid>
      {albums.map((a) => (
        <Link key={a.id} href={`/album/${a.id}`} className="group rounded-xl p-2.5 transition-colors hover:bg-surface-2">
          <Artwork src={a.cover_url} alt={`${a.title} cover`} size={220} className="w-full shadow-lg shadow-black/30" />
          <div className="mt-2.5 truncate text-sm font-semibold">{a.title}</div>
          <div className="truncate text-xs text-muted">{a.artist ? displayName(a.artist) : "Unknown artist"}</div>
          <div className="mt-0.5 text-xs text-subtle">
            {[a.release_date?.slice(0, 4), `${a.trackCount} ${a.trackCount === 1 ? "track" : "tracks"}`, a.genre].filter(Boolean).join(" · ")}
          </div>
        </Link>
      ))}
    </SongGrid>
  );
}

function ArtistGrid({ artists }: { artists: ArtistCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
      {artists.map((a) => (
        <Link key={a.id} href={`/u/${a.username}?tab=music`} className="rounded-xl p-3 text-center transition-colors hover:bg-surface-2">
          <Avatar user={a} size={112} className="mx-auto" />
          <div className="mt-2.5 truncate text-sm font-semibold">{displayName(a)}</div>
          <div className="truncate text-xs text-muted">
            {a.songs} {a.songs === 1 ? "song" : "songs"}
            {a.albums > 0 && ` · ${a.albums} ${a.albums === 1 ? "album" : "albums"}`}
          </div>
        </Link>
      ))}
    </div>
  );
}

async function Browse({ genre }: { genre: string | null }) {
  const user = await getCurrentUser();
  const [albums, tracks, artists] = await Promise.all([
    getNewAlbums({ genre, limit: 10 }),
    getLatestUploads({ genre, limit: 20 }),
    getUploadArtists({ genre, limit: 12 }),
  ]);

  if (albums.length === 0 && tracks.length === 0) {
    return (
      <EmptyState
        icon={Music2}
        title={genre ? `No ${genre} music yet` : "No music uploaded yet"}
        body="Be the first to release something — upload a single or a full album."
        action={
          <ButtonLink href="/upload">
            <Upload className="h-4 w-4" aria-hidden /> Upload music
          </ButtonLink>
        }
      />
    );
  }

  const favorites = await getFavoriteSongIds(user?.id, tracks.map((t) => t.id));
  return (
    <div className="space-y-10">
      {albums.length > 0 && (
        <section>
          <SectionHeader title="New releases" subtitle="Latest albums from Wavelength artists" />
          <AlbumGrid albums={albums} />
        </section>
      )}
      {tracks.length > 0 && (
        <section>
          <SectionHeader title="Latest tracks" subtitle="Freshly uploaded songs — press play to start the list" />
          <QueueScope tracks={tracks.map(toPlayable)} label={genre ? `Latest ${genre}` : "Latest tracks"}>
            <Tracklist tracks={tracks} favorites={favorites} signedIn={Boolean(user)} isOwner={false} />
          </QueueScope>
        </section>
      )}
      {artists.length > 0 && (
        <section>
          <SectionHeader title="Artists" subtitle="People making music on Wavelength" />
          <ArtistGrid artists={artists} />
        </section>
      )}
    </div>
  );
}

async function SongResults({ q }: { q: string }) {
  const user = await getCurrentUser();
  const songs = await searchLocalSongs(q, null, 40);
  if (songs.length === 0) return <EmptyState icon={SearchX} title={`No songs found for “${q}”`} body="Try another title, artist or album name." />;
  const favorites = await getFavoriteSongIds(user?.id, songs.map((s) => s.id));
  return (
    <QueueScope tracks={songs.map(toPlayable)} label={`Search · ${q}`}>
      <Tracklist tracks={songs} favorites={favorites} signedIn={Boolean(user)} isOwner={false} />
    </QueueScope>
  );
}

async function AlbumResults({ q }: { q: string }) {
  const albums = await searchAlbums(q);
  if (albums.length === 0) return <EmptyState icon={Disc3} title={`No albums found for “${q}”`} />;
  return <AlbumGrid albums={albums} />;
}

async function ArtistResults({ q }: { q: string }) {
  const artists = await searchArtists(q);
  if (artists.length === 0) return <EmptyState icon={MicVocal} title={`No artists found for “${q}”`} />;
  return <ArtistGrid artists={artists} />;
}

