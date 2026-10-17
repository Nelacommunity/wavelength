import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ShareComposer } from "@/components/social/share-composer";
import { requireUser } from "@/lib/data/auth";
import { getSong } from "@/lib/data/songs";
import type { CatalogTrack } from "@/lib/types";
import { getAlbum } from "@/lib/data/albums";
import { displayName } from "@/lib/utils";

export const metadata: Metadata = { title: "Share music" };

export default async function SharePage({ searchParams }: PageProps<"/share">) {
  const user = await requireUser("/share");
  const sp = await searchParams;

  const album = typeof sp.album === "string" ? await getAlbum(sp.album) : null;
  let initial: CatalogTrack | null = null;
  if (typeof sp.song === "string") initial = await getSong(sp.song);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={album ? "Share an album" : "Share music"}
        subtitle={album ? "Post the whole album to your followers' feeds." : "Pick a song, say why it matters, and post it to your followers."}
      />
      <ShareComposer
        initial={initial}
        user={user.profile}
        album={
          album
            ? { id: album.id, title: album.title, cover_url: album.cover_url, artist: displayName(album.artist), trackCount: album.tracks.length }
            : null
        }
      />
    </div>
  );
}
