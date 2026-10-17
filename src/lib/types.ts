export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  country: string | null;
  is_demo: boolean;
  created_at: string;
};

export type ProfileSummary = Pick<Profile, "id" | "username" | "display_name" | "avatar_url" | "is_demo">;

export type Song = {
  id: string;
  provider: "itunes" | "upload";
  provider_id: string;
  title: string;
  artist: string;
  album: string | null;
  artwork_url: string | null;
  preview_url: string | null;
  external_url: string | null;
  genre: string | null;
  duration_ms: number | null;
  release_date: string | null;
  /** Set for songs uploaded by Wavelength artists (full-length audio). */
  uploaded_by?: string | null;
  album_id?: string | null;
  audio_url?: string | null;
  track_number?: number | null;
};

export type Album = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  genre: string | null;
  cover_url: string | null;
  cover_path?: string | null;
  release_date: string | null;
  created_at: string;
};

/** A catalog track from the provider that may not be stored in our DB yet. */
export type CatalogTrack = Omit<Song, "id"> & { id?: string };

export type ReactionKey = "fire" | "heart" | "headphones" | "dance" | "chills";

export type FeedPost = {
  id: string;
  caption: string;
  created_at: string;
  user: ProfileSummary;
  song: Song;
  /** Set when the post shares a whole album. */
  album: (Pick<Album, "id" | "title" | "cover_url" | "genre"> & { track_count: number }) | null;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  reactions: { emoji: ReactionKey; count: number; mine: boolean }[];
};

export type Comment = {
  id: string;
  body: string;
  created_at: string;
  user: ProfileSummary;
};

export type Period = "day" | "week" | "month";

export type TrendDirection = "up" | "down" | "steady" | "new";

export type TrendingEntry = {
  rank: number;
  song: Song;
  listeners: number;
  plays: number;
  likes: number;
  shares: number;
  prevListeners: number;
  changePct: number | null;
  direction: TrendDirection;
  score: number;
  isDemo: boolean;
};

export type CurrentUser = { id: string; profile: Profile };
