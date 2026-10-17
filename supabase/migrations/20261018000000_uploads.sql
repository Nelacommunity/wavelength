-- Wavelength — artist uploads: albums, uploaded tracks, audio + cover storage.
--
-- Uploaded rows are written only by the server (service role) after it has
-- verified the files exist under the uploader's own storage folder, mirroring
-- how catalog songs are verified against the provider. Users upload the files
-- themselves, directly to Storage, restricted to <their uid>/ by policy.

create table public.albums (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  title               text not null check (char_length(title) between 1 and 200),
  description         text check (char_length(description) <= 1000),
  genre               text check (char_length(genre) <= 40),
  cover_url           text,
  cover_path          text,
  release_date        date,
  rights_confirmed_at timestamptz not null,
  created_at          timestamptz not null default now()
);
create index albums_user_idx on public.albums (user_id, created_at desc);

alter table public.songs drop constraint if exists songs_provider_check;
alter table public.songs add constraint songs_provider_check check (provider in ('itunes', 'upload'));
alter table public.songs alter column external_url drop not null;
alter table public.songs
  add column uploaded_by uuid references public.profiles (id) on delete cascade,
  add column album_id uuid references public.albums (id) on delete cascade,
  add column audio_url text,
  add column audio_path text,
  add column cover_path text,
  add column track_number integer check (track_number between 1 and 200),
  add column rights_confirmed_at timestamptz;

alter table public.songs add constraint songs_source_shape check (
  (provider = 'upload' and uploaded_by is not null and audio_url is not null and audio_path is not null and rights_confirmed_at is not null)
  or (provider <> 'upload' and uploaded_by is null and external_url is not null)
);
create index songs_uploaded_by_idx on public.songs (uploaded_by, created_at desc) where uploaded_by is not null;
create index songs_album_idx on public.songs (album_id, track_number) where album_id is not null;

alter table public.albums enable row level security;
create policy "Albums are public" on public.albums for select using (true);
-- No insert/update/delete policies: writes go through validated server actions.

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('tracks', 'tracks', true, 52428800, array[
    'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav',
    'audio/x-wav', 'audio/wave', 'audio/ogg', 'audio/flac', 'audio/x-flac', 'audio/webm']),
  ('covers', 'covers', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "Track audio is public" on storage.objects for select
  using (bucket_id in ('tracks', 'covers'));
create policy "Users upload own tracks and covers" on storage.objects for insert to authenticated
  with check (bucket_id in ('tracks', 'covers') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users update own tracks and covers" on storage.objects for update to authenticated
  using (bucket_id in ('tracks', 'covers') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete own tracks and covers" on storage.objects for delete to authenticated
  using (bucket_id in ('tracks', 'covers') and (storage.foldername(name))[1] = (select auth.uid())::text);
