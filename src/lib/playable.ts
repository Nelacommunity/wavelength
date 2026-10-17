import type { PlayableTrack } from "@/components/player/player-provider";

/** Shared by server and client components, so it must not live in a "use client" module. */
export function toPlayable(song: {
  id?: string;
  provider_id: string;
  title: string;
  artist: string;
  artwork_url: string | null;
  preview_url: string | null;
  external_url: string | null;
  audio_url?: string | null;
}): PlayableTrack {
  return {
    songId: song.id,
    providerId: song.provider_id,
    title: song.title,
    artist: song.artist,
    artwork_url: song.artwork_url,
    preview_url: song.audio_url ?? song.preview_url,
    external_url: song.external_url,
    fullTrack: Boolean(song.audio_url),
  };
}
