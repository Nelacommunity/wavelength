# Wavelength

A social music-sharing web app. Discover trending songs, share tracks with a caption, react and comment, follow listeners, and explore listener statistics.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Auth, Postgres, Storage, Realtime) · Recharts · Lucide

## Features

| Area | What's there |
| --- | --- |
| Home | Personalized greeting, trending chart (today/week/month), popular artists, recently shared, popular with listeners, community feed (everyone / following) with realtime "new posts" pill |
| Discover | Catalog search (songs, albums, artists), genre browsing, popularity scores, favorites, links to Apple Music |
| Trending | Ranked songs with listeners, % change, likes, shares, trend indicator; filters for period, country and genre |
| Listener stats | Total/active/new listeners, listener growth, sharing activity, most-listened songs, top artists, top song by country, plus a separate **Live activity** panel with real numbers only |
| Social | Posts with captions, likes, emoji reactions, comments, copy/share links, follow/unfollow, activity page |
| Upload music | Artists upload singles or albums: album cover, per-track covers (falling back to the album cover), drag-and-drop audio, track reordering and a rights confirmation. Uploads play in full in the player. |
| Profiles | Avatar upload, bio, country, followers/following, shares, uploaded music (albums & singles), favorites, top genres, activity feed |
| Player | Bottom player with play/pause, seek, volume, and a "Listen on Apple Music" link. It plays official 30-second previews only. If a track has no preview, nothing plays. |

## Music data provider

Song metadata, artwork and 30-second previews come from the public **iTunes Search API** (no API key). Every song links to Apple Music for full playback. The app only stores track metadata in `songs` after the server has looked the track up with the provider, so it never trusts track details sent by the client. The API allows roughly 20 requests per minute per IP. Results are cached in memory for an hour, and `/api/search` is rate limited per IP.

## Artist uploads

Uploading works in three steps:

1. The browser uploads files straight to Supabase Storage, so large audio files never go through a Next.js server action:
   - audio goes to the `tracks` bucket (up to 50 MB each)
   - covers go to the `covers` bucket (PNG, JPG or WebP, up to 5 MB)
   - storage policies only let users write under `<their uid>/`
2. The `createRelease` server action then checks that:
   - every path sits in the caller's own folder
   - every file actually exists in storage
   - the caller is under the daily limit of 60 tracks
3. The action writes the `albums` and `songs` rows with the service role. Users can't insert or edit these rows directly, so a client can't point a song at someone else's file or an arbitrary URL.

Owners can delete a track or a whole album, and the matching storage files are removed with it. Uploaders must confirm they own the rights, and the confirmation time is stored in `rights_confirmed_at`.

## Real data vs. demo data

- `supabase/seed.sql` contains **demo data**:
  - 36 real catalog tracks
  - 10 demo users
  - posts, likes, comments and follows between those users
  - 120 days of simulated per-song and per-country listener stats
- Demo users are flagged `is_demo` and get random passwords, so nobody can sign in as them.
- Every stats row has a `source` column: `demo` or `live`. Wherever demo rows contribute, the UI shows a yellow **Demo data** badge. Numbers computed from real listening events show a green **Live data** badge.
- The **Live activity** panel on the stats page counts real accounts only.
- Rankings are anchored to the most recent day that has stats. Old seed data still renders, and the page states the date range it covers.

### What counts as a listen

A listen is recorded only when a signed-in user's preview has played **≥30 s of continuous audio** (`preview_30s`), or has played to the end after ≥25 s (`preview_complete`). Page views never count. Clicks on "Listen on Apple Music" are stored as `external_open` for analytics only and are never counted as listens. The database also enforces:

- at most one listen per user per song every 25 s
- at most 120 events per user per hour
- server timestamps, so clients can't backdate events

## Trending algorithm

`src/lib/trending.ts` holds the algorithm. Its weights are configurable through `DEFAULT_WEIGHTS`:

```
score = 100 × Σ wᵢ · normalizedᵢ
listeners 32% · plays 13% · growth 22% · shares 13% · likes 10% · recency 10%
```

- **Counts** (listeners, plays, likes, shares) are log-normalized against the maximum in the candidate set.
- **Growth** is the % change in listeners vs. the previous window of equal length, clamped to −100%…+200% and then mapped to 0–1. New entries get full growth credit.
- **Recency** is the share of the window's listeners that fell in its most recent third.

Per-window aggregates come from the SQL function `song_window_stats`, which reads `daily_song_stats`.

To roll real activity into the stats tables, run this on a schedule (pg_cron or any job using the service role):

```sql
select cron.schedule('wavelength-stats', '*/15 * * * *', $$select public.refresh_daily_stats(current_date)$$);
```

## Getting started

### 1. Create a Supabase project

Use a hosted project at [supabase.com](https://supabase.com), or run `npx supabase start` locally (requires Docker).

### 2. Apply the schema and seed

Pick one of these options:

- **Supabase CLI:**
  ```bash
  npx supabase db push --db-url "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres"
  ```
  Then run `supabase/seed.sql` from the SQL editor.
- **SQL editor:** run each file in `supabase/migrations/` in filename order (`…_init.sql`, then `…_uploads.sql`), then optionally `supabase/seed.sql`.
- **Local:** `npx supabase db reset` applies both.

> The seed is demo-only. Don't run it on a production database you care about.

To regenerate the seed after editing `data/catalog.json`, run `node scripts/generate-seed.mjs`.

### 3. Configure the environment

```bash
cp .env.example .env.local
```

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API (anon / publishable key) |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API (service role). **Server-only.** Never prefix it with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SITE_URL` | Your deployed URL. It's used for share links and email redirects. |

In **Authentication → URL Configuration**, add `<SITE_URL>/auth/callback` as a redirect URL. If email confirmation is on, users confirm through that route.

### 4. Run

```bash
npm install
npm run dev
```

## Security

- **Row Level Security** is on for every table:
  - Everyone can read public data.
  - Writes require `auth.uid()` to match the row owner.
  - Column-level grants stop users from changing `is_demo`, ids or other protected fields.
  - The `songs` table and stats tables are writable only by the service role.
- **Duplicate prevention:** composite primary keys stop duplicate likes, follows, favorites and reactions. A check constraint blocks self-follows.
- **Rate limits** are enforced by database triggers, so they hold even if someone calls the Supabase API directly:

  | Action | Limit per user |
  | --- | --- |
  | Posts | 10 per 10 min |
  | Comments | 15 per min |
  | Likes and reactions | 60 per min |
  | Follows | 30 per min |
  | Favorites | 60 per min |
  | Listening events | 120 per hour |

- **Input validation:** server actions validate input with zod and strip control characters. Text is always rendered escaped.
- **Avatars:**
  - Uploads must be PNG, JPEG, WebP or GIF, at most 2 MB.
  - Each user can only write under `avatars/<their uid>/`.
- **Keys:** the service role key is only imported from `server-only` modules.

## Project structure

```
src/
  app/(app)/            pages with the app shell (home, discover, trending, stats, share, activity, song, post, u, settings)
  app/(auth)/           login & sign-up
  app/api/search/       catalog search endpoint used by the share composer
  app/auth/callback/    email confirmation handler
  components/           ui, layout, music, social, charts, player
  lib/data/             server-side queries (data access layer)
  lib/actions/          server actions (mutations)
  lib/itunes.ts         music provider adapter
  lib/trending.ts       trending score
supabase/migrations/    schema, RLS, triggers, SQL functions, storage
supabase/seed.sql       generated demo data
```

To add another provider (for example Spotify or Deezer), add it to the `songs.provider` check constraint and write an adapter shaped like `lib/itunes.ts`.
