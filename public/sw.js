/* Wavelength service worker
 * - Installable app shell + offline fallback page.
 * - Saves music you've listened to on the device and plays it from there
 *   (instant start, instant seeking, works offline), with an LRU size cap.
 * Never caches HTML, API calls or server actions, so pages are always fresh. */
const VERSION = "wl-v2";
const STATIC_CACHE = `${VERSION}-static`;
const IMAGE_CACHE = `${VERSION}-images`;
// Not versioned: saved music survives app updates.
const AUDIO_CACHE = "wl-audio";
const AUDIO_META = "wl-audio-meta";
const META_KEY = "/__wl_audio_meta__";
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png", "/icon.svg"];
const MAX_IMAGES = 200;
const MAX_AUDIO_BYTES = 400 * 1024 * 1024;
const MAX_AUDIO_TRACKS = 120;
const MAX_TRACK_BYTES = 60 * 1024 * 1024;
const AUDIO_PATH = "/storage/v1/object/public/tracks/";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(VERSION) && k !== AUDIO_CACHE && k !== AUDIO_META)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

// ---------------------------------------------------------------------------
// Saved music
// ---------------------------------------------------------------------------

/** { [url]: { size, lastPlayed, savedAt } } */
async function readMeta() {
  const res = await (await caches.open(AUDIO_META)).match(META_KEY);
  return res ? res.json() : {};
}
async function writeMeta(meta) {
  await (await caches.open(AUDIO_META)).put(META_KEY, new Response(JSON.stringify(meta), { headers: { "Content-Type": "application/json" } }));
}

// Serialize metadata updates so concurrent writes don't clobber each other.
let metaChain = Promise.resolve();
function updateMeta(fn) {
  metaChain = metaChain.then(async () => {
    const meta = await readMeta();
    const out = await fn(meta);
    await writeMeta(meta);
    return out;
  }).catch(() => {});
  return metaChain;
}

/** Evict least-recently-played tracks until under the size/count caps. */
async function enforceLimits(meta) {
  const cache = await caches.open(AUDIO_CACHE);
  const entries = Object.entries(meta).sort((a, b) => a[1].lastPlayed - b[1].lastPlayed);
  let total = entries.reduce((s, [, m]) => s + (m.size || 0), 0);
  let count = entries.length;
  for (const [url, m] of entries) {
    if (total <= MAX_AUDIO_BYTES && count <= MAX_AUDIO_TRACKS) break;
    await cache.delete(url);
    delete meta[url];
    total -= m.size || 0;
    count -= 1;
  }
}

const inFlight = new Map();

/** Download a whole track once and keep it. */
function saveTrack(url) {
  if (inFlight.has(url)) return inFlight.get(url);
  const job = (async () => {
    const cache = await caches.open(AUDIO_CACHE);
    if (await cache.match(url)) {
      await updateMeta((meta) => {
        if (meta[url]) meta[url].lastPlayed = Date.now();
      });
      return;
    }
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok || res.status !== 200) return;
    const size = Number(res.headers.get("content-length")) || 0;
    if (size > MAX_TRACK_BYTES) return;
    const blob = await res.blob();
    await cache.put(
      url,
      new Response(blob, { headers: { "Content-Type": res.headers.get("content-type") || "audio/mpeg", "Content-Length": String(blob.size) } }),
    );
    await updateMeta(async (meta) => {
      meta[url] = { size: blob.size, lastPlayed: Date.now(), savedAt: Date.now() };
      await enforceLimits(meta);
    });
    const clients = await self.clients.matchAll({ type: "window" });
    clients.forEach((c) => c.postMessage({ type: "track-saved", url }));
  })()
    .catch(() => {})
    .finally(() => inFlight.delete(url));
  inFlight.set(url, job);
  return job;
}

/** Serve a (possibly ranged) request for a saved track from the cache. */
async function respondFromSaved(request) {
  const cache = await caches.open(AUDIO_CACHE);
  const hit = await cache.match(request.url);
  if (!hit) return null;
  const blob = await hit.blob();
  const type = hit.headers.get("content-type") || "audio/mpeg";
  const total = blob.size;
  updateMeta((meta) => {
    if (meta[request.url]) meta[request.url].lastPlayed = Date.now();
  });

  const range = request.headers.get("range");
  const m = range && /bytes=(\d*)-(\d*)/.exec(range);
  if (!m) {
    return new Response(blob, { status: 200, headers: { "Content-Type": type, "Content-Length": String(total), "Accept-Ranges": "bytes" } });
  }
  let start = m[1] === "" ? NaN : Number(m[1]);
  let end = m[2] === "" ? total - 1 : Number(m[2]);
  if (Number.isNaN(start)) {
    // Suffix range: last N bytes.
    start = Math.max(0, total - end);
    end = total - 1;
  }
  end = Math.min(end, total - 1);
  if (start > end || start >= total) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
  }
  return new Response(blob.slice(start, end + 1, type), {
    status: 206,
    headers: {
      "Content-Type": type,
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "Accept-Ranges": "bytes",
    },
  });
}

self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "save-track" && typeof msg.url === "string" && msg.url.includes(AUDIO_PATH)) {
    event.waitUntil(saveTrack(msg.url));
  } else if (msg.type === "audio-cache-info") {
    event.waitUntil(
      readMeta().then((meta) => {
        const items = Object.values(meta);
        event.source?.postMessage({
          type: "audio-cache-info",
          tracks: items.length,
          bytes: items.reduce((s, m) => s + (m.size || 0), 0),
          urls: Object.keys(meta),
        });
      }),
    );
  } else if (msg.type === "audio-cache-clear") {
    event.waitUntil(
      Promise.all([caches.delete(AUDIO_CACHE), caches.delete(AUDIO_META)]).then(() =>
        event.source?.postMessage({ type: "audio-cache-info", tracks: 0, bytes: 0, urls: [] }),
      ),
    );
  }
});

// ---------------------------------------------------------------------------
// Fetch routing
// ---------------------------------------------------------------------------

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Uploaded music: play saved copies from the device; otherwise stream normally.
  if (url.pathname.includes(AUDIO_PATH)) {
    event.respondWith(respondFromSaved(req).then((res) => res || fetch(req)));
    return;
  }

  if (req.headers.has("range")) return;

  // Page navigations: always network; offline page when there's no connection.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Hashed build assets are immutable: cache-first.
  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(STATIC_CACHE).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  // Cover art (uploaded covers + icons): stale-while-revalidate.
  const isArtwork =
    req.destination === "image" &&
    (url.hostname.endsWith("mzstatic.com") || url.pathname.includes("/storage/v1/object/public/covers/") || url.pathname.startsWith("/icons/"));
  if (isArtwork) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res.ok || res.type === "opaque") {
              cache.put(req, res.clone());
              trim(IMAGE_CACHE, MAX_IMAGES);
            }
            return res;
          })
          .catch(() => hit);
        return hit || network;
      }),
    );
  }
});
