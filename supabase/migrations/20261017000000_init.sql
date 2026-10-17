-- Wavelength — initial schema
-- Tables, indexes, RLS policies, rate-limit triggers, stats functions and storage.

create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     extensions.citext not null unique
               check (username ~ '^[a-zA-Z0-9_]{3,24}$'),
  display_name text check (char_length(display_name) <= 50),
  avatar_url   text check (char_length(avatar_url) <= 500),
  bio          text check (char_length(bio) <= 280),
  country      text check (country ~ '^[A-Z]{2}$'),
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Songs (catalog metadata from an external provider)
-- ---------------------------------------------------------------------------
create table public.songs (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null check (provider in ('itunes')),
  provider_id  text not null,
  title        text not null check (char_length(title) between 1 and 300),
  artist       text not null check (char_length(artist) between 1 and 300),
  album        text check (char_length(album) <= 300),
  artwork_url  text,
  preview_url  text,
  external_url text not null,
  genre        text,
  duration_ms  integer,
  release_date date,
  created_at   timestamptz not null default now(),
  unique (provider, provider_id)
);
create index songs_genre_idx on public.songs (genre);
create index songs_artist_idx on public.songs (artist);

-- ---------------------------------------------------------------------------
-- Social
-- ---------------------------------------------------------------------------
create table public.music_posts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  song_id    uuid not null references public.songs (id) on delete cascade,
  caption    text not null default '' check (char_length(caption) <= 500),
  created_at timestamptz not null default now()
);
create index music_posts_created_idx on public.music_posts (created_at desc);
create index music_posts_user_idx on public.music_posts (user_id, created_at desc);
create index music_posts_song_idx on public.music_posts (song_id);

create table public.likes (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  post_id    uuid not null references public.music_posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id) -- prevents duplicate likes
);
create index likes_post_idx on public.likes (post_id);

create table public.post_reactions (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  post_id    uuid not null references public.music_posts (id) on delete cascade,
  emoji      text not null check (emoji in ('fire', 'heart', 'headphones', 'dance', 'chills')),
  created_at timestamptz not null default now(),
  primary key (user_id, post_id, emoji)
);
create index post_reactions_post_idx on public.post_reactions (post_id);

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  post_id    uuid not null references public.music_posts (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index comments_post_idx on public.comments (post_id, created_at);
create index comments_user_idx on public.comments (user_id);

create table public.follows (
  follower_id  uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id), -- prevents duplicate follows
  check (follower_id <> following_id)
);
create index follows_following_idx on public.follows (following_id);

create table public.favorites (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  song_id    uuid not null references public.songs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, song_id)
);
create index favorites_song_idx on public.favorites (song_id);

-- ---------------------------------------------------------------------------
-- Listening data
-- ---------------------------------------------------------------------------
-- Only verified listening events are stored: a preview that actually played
-- for at least 30 seconds of audio (or to completion). Page views and
-- outbound clicks are NOT listens; 'external_open' is kept for analytics only.
create table public.listening_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  song_id     uuid not null references public.songs (id) on delete cascade,
  event_type  text not null check (event_type in ('preview_30s', 'preview_complete', 'external_open')),
  listened_ms integer not null default 0 check (listened_ms >= 0 and listened_ms <= 3600000),
  country     text not null default 'ZZ' check (country ~ '^[A-Z]{2}$'),
  occurred_at timestamptz not null default now()
);
create index listening_events_song_time_idx on public.listening_events (song_id, occurred_at desc);
create index listening_events_user_time_idx on public.listening_events (user_id, occurred_at desc);
create index listening_events_time_idx on public.listening_events (occurred_at);

-- Daily per-song, per-country aggregates. `source` separates seeded demo
-- numbers from live numbers computed from listening_events.
create table public.daily_song_stats (
  song_id          uuid not null references public.songs (id) on delete cascade,
  stat_date        date not null,
  country          text not null check (country ~ '^[A-Z]{2}$'),
  source           text not null default 'live' check (source in ('demo', 'live')),
  unique_listeners integer not null default 0 check (unique_listeners >= 0),
  plays            integer not null default 0 check (plays >= 0),
  likes            integer not null default 0 check (likes >= 0),
  shares           integer not null default 0 check (shares >= 0),
  trend_score      numeric(6, 2) not null default 0,
  primary key (song_id, stat_date, country, source)
);
create index daily_song_stats_date_idx on public.daily_song_stats (stat_date);
create index daily_song_stats_country_date_idx on public.daily_song_stats (country, stat_date);

create table public.daily_platform_stats (
  stat_date        date not null,
  source           text not null default 'live' check (source in ('demo', 'live')),
  total_listeners  integer not null default 0,
  active_listeners integer not null default 0,
  new_listeners    integer not null default 0,
  shares           integer not null default 0,
  primary key (stat_date, source)
);

-- ---------------------------------------------------------------------------
-- Triggers: new-user profile, updated_at, rate limits
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_name text;
  final_name text;
  n int := 0;
begin
  base_name := regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '[^a-zA-Z0-9_]', '', 'g');
  if char_length(base_name) < 3 then
    base_name := 'listener_' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  base_name := left(base_name, 20);
  final_name := base_name;
  while exists (select 1 from public.profiles where username = final_name) loop
    n := n + 1;
    final_name := base_name || n::text;
  end loop;

  insert into public.profiles (id, username, display_name, is_demo)
  values (
    new.id,
    final_name,
    left(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 50),
    -- app metadata is only writable server-side, so users can't self-flag as demo
    coalesce((new.raw_app_meta_data ->> 'demo')::boolean, false)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Generic per-user rate limiter.
-- args: user column, max rows, window (interval text), timestamp column
create or replace function public.enforce_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_col text := tg_argv[0];
  max_rows int := tg_argv[1]::int;
  win interval := tg_argv[2]::interval;
  ts_col text := coalesce(tg_argv[3], 'created_at');
  uid uuid;
  recent int;
begin
  -- Service-role / seed inserts carry no end-user JWT; don't limit them.
  if auth.uid() is null then
    return new;
  end if;

  execute format('select ($1).%I', user_col) into uid using new;
  execute format(
    'select count(*) from %I.%I where %I = $1 and %I > now() - $2',
    tg_table_schema, tg_table_name, user_col, ts_col
  ) into recent using uid, win;

  if recent >= max_rows then
    raise exception 'Rate limit exceeded. Please slow down and try again shortly.'
      using errcode = 'P0429';
  end if;
  return new;
end;
$$;

create trigger music_posts_rate_limit before insert on public.music_posts
  for each row execute function public.enforce_rate_limit('user_id', '10', '10 minutes');
create trigger comments_rate_limit before insert on public.comments
  for each row execute function public.enforce_rate_limit('user_id', '15', '1 minute');
create trigger likes_rate_limit before insert on public.likes
  for each row execute function public.enforce_rate_limit('user_id', '60', '1 minute');
create trigger reactions_rate_limit before insert on public.post_reactions
  for each row execute function public.enforce_rate_limit('user_id', '60', '1 minute');
create trigger follows_rate_limit before insert on public.follows
  for each row execute function public.enforce_rate_limit('follower_id', '30', '1 minute');
create trigger favorites_rate_limit before insert on public.favorites
  for each row execute function public.enforce_rate_limit('user_id', '60', '1 minute');
create trigger listening_events_rate_limit before insert on public.listening_events
  for each row execute function public.enforce_rate_limit('user_id', '120', '1 hour', 'occurred_at');

-- A user can log at most one verified listen per song every 25 seconds
-- (a 30-second preview cannot legitimately produce more).
create or replace function public.enforce_listen_spacing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or new.event_type = 'external_open' then
    return new;
  end if;
  if exists (
    select 1 from public.listening_events
    where user_id = new.user_id and song_id = new.song_id
      and event_type <> 'external_open'
      and occurred_at > now() - interval '25 seconds'
  ) then
    raise exception 'Duplicate listen ignored.' using errcode = 'P0429';
  end if;
  new.occurred_at := now(); -- clients cannot backdate listens
  return new;
end;
$$;

create trigger listening_events_spacing before insert on public.listening_events
  for each row execute function public.enforce_listen_spacing();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.songs enable row level security;
alter table public.music_posts enable row level security;
alter table public.likes enable row level security;
alter table public.post_reactions enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.favorites enable row level security;
alter table public.listening_events enable row level security;
alter table public.daily_song_stats enable row level security;
alter table public.daily_platform_stats enable row level security;

-- profiles: public read, owner-only update of safe columns
create policy "Profiles are public" on public.profiles for select using (true);
create policy "Users update own profile" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
revoke update on public.profiles from anon, authenticated;
grant update (username, display_name, avatar_url, bio, country) on public.profiles to authenticated;

-- songs: public read; writes only through the server (service role) after
-- the metadata has been verified against the provider.
create policy "Songs are public" on public.songs for select using (true);

-- music_posts
create policy "Posts are public" on public.music_posts for select using (true);
create policy "Users create own posts" on public.music_posts for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users delete own posts" on public.music_posts for delete to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users edit own posts" on public.music_posts for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke update on public.music_posts from anon, authenticated;
grant update (caption) on public.music_posts to authenticated;

-- likes
create policy "Likes are public" on public.likes for select using (true);
create policy "Users like as themselves" on public.likes for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users remove own likes" on public.likes for delete to authenticated
  using ((select auth.uid()) = user_id);

-- reactions
create policy "Reactions are public" on public.post_reactions for select using (true);
create policy "Users react as themselves" on public.post_reactions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users remove own reactions" on public.post_reactions for delete to authenticated
  using ((select auth.uid()) = user_id);

-- comments
create policy "Comments are public" on public.comments for select using (true);
create policy "Users comment as themselves" on public.comments for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users delete own comments" on public.comments for delete to authenticated
  using ((select auth.uid()) = user_id);

-- follows
create policy "Follows are public" on public.follows for select using (true);
create policy "Users follow as themselves" on public.follows for insert to authenticated
  with check ((select auth.uid()) = follower_id);
create policy "Users unfollow as themselves" on public.follows for delete to authenticated
  using ((select auth.uid()) = follower_id);

-- favorites
create policy "Favorites are public" on public.favorites for select using (true);
create policy "Users favorite as themselves" on public.favorites for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users remove own favorites" on public.favorites for delete to authenticated
  using ((select auth.uid()) = user_id);

-- listening events: private to the listener; aggregated stats are public
create policy "Users read own listening events" on public.listening_events for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users log own listening events" on public.listening_events for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Song stats are public" on public.daily_song_stats for select using (true);
create policy "Platform stats are public" on public.daily_platform_stats for select using (true);

-- ---------------------------------------------------------------------------
-- Stats functions
-- ---------------------------------------------------------------------------

-- Most recent day with stats; rankings are anchored here so seeded demo data
-- stays meaningful even when the seed is older than today.
create or replace function public.stats_anchor_date()
returns date
language sql
stable
set search_path = ''
as $$
  select coalesce(max(stat_date), current_date) from public.daily_song_stats;
$$;

-- Aggregated per-song stats for a window [p_start, p_end] and the previous
-- window of the same length, used by the trending score (computed in app code).
create or replace function public.song_window_stats(
  p_start date,
  p_end date,
  p_country text default null,
  p_genre text default null
)
returns table (
  song_id uuid,
  listeners bigint,
  plays bigint,
  likes bigint,
  shares bigint,
  prev_listeners bigint,
  recent_listeners bigint,
  demo_rows bigint,
  live_rows bigint
)
language sql
stable
set search_path = ''
as $$
  with bounds as (
    select
      p_start as s,
      p_end as e,
      p_start - (p_end - p_start + 1) as ps,
      greatest(p_start, p_end - ((p_end - p_start) / 3)) as rs
  )
  select
    d.song_id,
    coalesce(sum(d.unique_listeners) filter (where d.stat_date between b.s and b.e), 0),
    coalesce(sum(d.plays) filter (where d.stat_date between b.s and b.e), 0),
    coalesce(sum(d.likes) filter (where d.stat_date between b.s and b.e), 0),
    coalesce(sum(d.shares) filter (where d.stat_date between b.s and b.e), 0),
    coalesce(sum(d.unique_listeners) filter (where d.stat_date between b.ps and b.s - 1), 0),
    coalesce(sum(d.unique_listeners) filter (where d.stat_date between b.rs and b.e), 0),
    count(*) filter (where d.source = 'demo'),
    count(*) filter (where d.source = 'live')
  from public.daily_song_stats d
  cross join bounds b
  join public.songs so on so.id = d.song_id
  where d.stat_date between b.ps and b.e
    and (p_country is null or d.country = p_country)
    and (p_genre is null or so.genre = p_genre)
  group by d.song_id;
$$;

-- Daily listener series for a set of songs (trend charts).
create or replace function public.song_daily_series(
  p_song_ids uuid[],
  p_start date,
  p_end date,
  p_country text default null
)
returns table (song_id uuid, stat_date date, listeners bigint, plays bigint)
language sql
stable
set search_path = ''
as $$
  select d.song_id, d.stat_date, sum(d.unique_listeners), sum(d.plays)
  from public.daily_song_stats d
  where d.song_id = any (p_song_ids)
    and d.stat_date between p_start and p_end
    and (p_country is null or d.country = p_country)
  group by d.song_id, d.stat_date
  order by d.stat_date;
$$;

-- Listener totals per country for a window.
create or replace function public.country_window_stats(p_start date, p_end date)
returns table (country text, listeners bigint, plays bigint, shares bigint)
language sql
stable
set search_path = ''
as $$
  select d.country, sum(d.unique_listeners), sum(d.plays), sum(d.shares)
  from public.daily_song_stats d
  where d.stat_date between p_start and p_end
  group by d.country
  order by 2 desc;
$$;

-- Top song per country for a window.
create or replace function public.top_song_by_country(p_start date, p_end date)
returns table (country text, song_id uuid, listeners bigint)
language sql
stable
set search_path = ''
as $$
  select distinct on (t.country) t.country, t.song_id, t.listeners
  from (
    select d.country, d.song_id, sum(d.unique_listeners) as listeners
    from public.daily_song_stats d
    where d.stat_date between p_start and p_end
    group by d.country, d.song_id
  ) t
  order by t.country, t.listeners desc;
$$;

-- Platform activity counts from real (non-demo) tables.
create or replace function public.live_platform_counts()
returns table (profiles bigint, posts bigint, likes bigint, comments bigint, listens bigint, listeners bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.profiles where not is_demo),
    (select count(*) from public.music_posts p join public.profiles u on u.id = p.user_id where not u.is_demo),
    (select count(*) from public.likes l join public.profiles u on u.id = l.user_id where not u.is_demo),
    (select count(*) from public.comments c join public.profiles u on u.id = c.user_id where not u.is_demo),
    (select count(*) from public.listening_events where event_type <> 'external_open'),
    (select count(distinct user_id) from public.listening_events where event_type <> 'external_open');
$$;

-- Roll verified listening events + social activity for one day into the
-- live stats tables. Run daily (and optionally hourly for "today") via
-- pg_cron or a scheduled job using the service role:
--   select cron.schedule('wavelength-stats', '*/15 * * * *',
--     $$select public.refresh_daily_stats(current_date)$$);
create or replace function public.refresh_daily_stats(p_date date default current_date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.daily_song_stats where stat_date = p_date and source = 'live';

  insert into public.daily_song_stats (song_id, stat_date, country, source, unique_listeners, plays, likes, shares)
  select
    k.song_id, p_date, k.country, 'live',
    coalesce(l.listeners, 0), coalesce(l.plays, 0), coalesce(lk.likes, 0), coalesce(sh.shares, 0)
  from (
    select song_id, country from public.listening_events
      where occurred_at >= p_date and occurred_at < p_date + 1 and event_type <> 'external_open'
    union
    select p.song_id, coalesce(u.country, 'ZZ') from public.music_posts p
      join public.profiles u on u.id = p.user_id
      where p.created_at >= p_date and p.created_at < p_date + 1 and not u.is_demo
    union
    select p.song_id, coalesce(u.country, 'ZZ') from public.likes x
      join public.music_posts p on p.id = x.post_id
      join public.profiles u on u.id = x.user_id
      where x.created_at >= p_date and x.created_at < p_date + 1 and not u.is_demo
  ) k
  left join (
    select song_id, country, count(distinct user_id) as listeners, count(*) as plays
    from public.listening_events
    where occurred_at >= p_date and occurred_at < p_date + 1 and event_type <> 'external_open'
    group by song_id, country
  ) l on l.song_id = k.song_id and l.country = k.country
  left join (
    select p.song_id, coalesce(u.country, 'ZZ') as country, count(*) as likes
    from public.likes x
    join public.music_posts p on p.id = x.post_id
    join public.profiles u on u.id = x.user_id
    where x.created_at >= p_date and x.created_at < p_date + 1 and not u.is_demo
    group by 1, 2
  ) lk on lk.song_id = k.song_id and lk.country = k.country
  left join (
    select p.song_id, coalesce(u.country, 'ZZ') as country, count(*) as shares
    from public.music_posts p
    join public.profiles u on u.id = p.user_id
    where p.created_at >= p_date and p.created_at < p_date + 1 and not u.is_demo
    group by 1, 2
  ) sh on sh.song_id = k.song_id and sh.country = k.country;

  insert into public.daily_platform_stats (stat_date, source, total_listeners, active_listeners, new_listeners, shares)
  select
    p_date, 'live',
    (select count(distinct user_id) from public.listening_events
      where occurred_at < p_date + 1 and event_type <> 'external_open'),
    (select count(distinct user_id) from public.listening_events
      where occurred_at >= p_date and occurred_at < p_date + 1 and event_type <> 'external_open'),
    (select count(*) from (
      select user_id from public.listening_events where event_type <> 'external_open'
      group by user_id having min(occurred_at) >= p_date and min(occurred_at) < p_date + 1) f),
    (select count(*) from public.music_posts p join public.profiles u on u.id = p.user_id
      where p.created_at >= p_date and p.created_at < p_date + 1 and not u.is_demo)
  on conflict (stat_date, source) do update set
    total_listeners = excluded.total_listeners,
    active_listeners = excluded.active_listeners,
    new_listeners = excluded.new_listeners,
    shares = excluded.shares;
end;
$$;

revoke execute on function public.refresh_daily_stats(date) from public, anon, authenticated;
revoke execute on function public.live_platform_counts() from public;
grant execute on function public.live_platform_counts() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: stream new posts into open feeds
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.music_posts;

-- ---------------------------------------------------------------------------
-- Storage: avatars bucket (public read, owner-only write under <uid>/)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy "Avatar images are public" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "Users upload own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users update own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
