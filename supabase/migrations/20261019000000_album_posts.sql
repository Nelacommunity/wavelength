-- Wavelength — share whole albums to the feed.
-- An album post still points at a song (the album's first track) so every
-- existing feed query, stat and player path keeps working; `album_id` marks
-- the post as an album share.

alter table public.music_posts
  add column album_id uuid references public.albums (id) on delete cascade;

create index music_posts_album_idx on public.music_posts (album_id) where album_id is not null;
