import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { UploadStudio } from "@/components/music/upload-studio";
import { requireUser } from "@/lib/data/auth";
import { getUserMusic } from "@/lib/data/albums";
import { displayName } from "@/lib/utils";

export const metadata: Metadata = { title: "Upload music" };

export default async function UploadPage({ searchParams }: PageProps<"/upload">) {
  const user = await requireUser("/upload");
  const sp = await searchParams;
  const { albums } = await getUserMusic(user.id);
  const initialAlbumId = typeof sp.album === "string" ? sp.album : null;
  const adding = albums.find((a) => a.id === initialAlbumId);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={adding ? `Add tracks to “${adding.title}”` : "Upload your music"}
        subtitle={
          adding
            ? "Upload more songs whenever they're ready. They're added after the existing tracks."
            : "Release a single, start an album, or keep adding tracks to an album you've already published."
        }
      />
      <UploadStudio
        userId={user.id}
        artistName={displayName(user.profile)}
        albums={albums.map((a) => ({ id: a.id, title: a.title, cover_url: a.cover_url, trackCount: a.trackCount }))}
        initialAlbumId={initialAlbumId}
      />
    </div>
  );
}
