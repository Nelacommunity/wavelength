"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { recordListen } from "@/lib/actions/songs";
import { getAudioCacheInfo, saveTrackForOffline } from "@/lib/audio-cache";

export type PlayableTrack = {
  songId?: string;
  providerId: string;
  title: string;
  artist: string;
  artwork_url: string | null;
  /** Playback source URL. */
  preview_url: string | null;
  external_url: string | null;
  /** True for full-length tracks uploaded to Wavelength. */
  fullTrack?: boolean;
};

export type RepeatMode = "off" | "all" | "one";

type PlayerState = {
  track: PlayableTrack | null;
  playing: boolean;
  /** Waiting for audio data (start of a track, or rebuffering). */
  loading: boolean;
  error: string | null;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  /** Where the current queue came from, e.g. "Album · Midnight Tapes". */
  source: string | null;
  /** The current track is saved on this device (instant, offline playback). */
  savedOffline: boolean;
  /** Tracks after the current one, in play order. */
  upNext: PlayableTrack[];
  hasNext: boolean;
  hasPrevious: boolean;
};

type PlayerApi = PlayerState & {
  /** Play a track; pass a queue to continue through a list like an album. */
  play: (track: PlayableTrack, queue?: PlayableTrack[], source?: string | null) => void;
  /** Start a list from the beginning (or a random track when shuffling). */
  playList: (tracks: PlayableTrack[], source?: string | null, opts?: { shuffle?: boolean }) => void;
  /** Start buffering a track before it's played (e.g. on pointer down). */
  prime: (track: PlayableTrack) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  jumpTo: (providerId: string) => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  isCurrent: (providerId: string) => boolean;
  isSource: (source: string) => boolean;
};

/** Playback position lives in its own context so only progress bars re-render 4×/s. */
type PlayerTime = { currentTime: number; duration: number; buffered: number };

const PlayerContext = createContext<PlayerApi | null>(null);
const PlayerTimeContext = createContext<PlayerTime>({ currentTime: 0, duration: 0, buffered: 0 });

function readStoredVolume() {
  try {
    const raw = typeof window === "undefined" ? null : localStorage.getItem("wl-volume");
    const v = Number(raw);
    return raw !== null && v >= 0 && v <= 1 ? v : 0.8;
  } catch {
    return 0.8;
  }
}

function shuffled<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const LISTEN_THRESHOLD_MS = 30_000;
const COMPLETE_MIN_MS = 25_000;
const RESTART_THRESHOLD_S = 3;
/** If audio is stuck buffering this long, reconnect and resume. */
const STALL_TIMEOUT_MS = 7_000;
const MAX_RETRIES = 4;

type Queue = {
  tracks: PlayableTrack[];
  /** Play order: a permutation of indexes into `tracks`. */
  order: number[];
  pos: number;
  source: string | null;
};

const EMPTY_QUEUE: Queue = { tracks: [], order: [], pos: 0, source: null };
const currentOf = (q: Queue) => (q.order.length ? q.tracks[q.order[q.pos]] ?? null : null);

/** The position the queue would move to, skipping tracks with no audio. */
function stepPos(q: Queue, dir: 1 | -1, repeat: RepeatMode): number | null {
  const n = q.order.length;
  let pos = q.pos;
  for (let tries = 0; tries < n; tries++) {
    pos += dir;
    if (pos >= n) {
      if (repeat !== "all") return null;
      pos = 0;
    }
    if (pos < 0) {
      if (repeat !== "all") return null;
      pos = n - 1;
    }
    if (q.tracks[q.order[pos]]?.preview_url) return pos;
  }
  return null;
}

function makeAudio(volume: number) {
  const a = new Audio();
  a.preload = "auto";
  a.volume = volume;
  return a;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  // Two elements: the active one plays; the standby one buffers the next track
  // so skipping and auto-advance start instantly (double buffering).
  const activeRef = useRef<HTMLAudioElement | null>(null);
  const standbyRef = useRef<HTMLAudioElement | null>(null);
  const listened = useRef({ ms: 0, last: 0, recorded: false, saved: false });
  const queueRef = useRef<Queue>(EMPTY_QUEUE);
  const shuffleRef = useRef(false);
  const repeatRef = useRef<RepeatMode>("off");
  const wantPlayRef = useRef(false);
  const retryRef = useRef({ count: 0, timer: 0 as ReturnType<typeof setTimeout> | 0 });
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumeRef = useRef({ volume: readStoredVolume(), muted: false });
  // Elements that have played at least once. iOS only lets an element start
  // without a tap if a tap has started it before, so non-tap auto-advance only
  // swaps to an "unlocked" element.
  const unlockedRef = useRef(new WeakSet<HTMLAudioElement>());

  const [queue, setQueue] = useState<Queue>(EMPTY_QUEUE);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [state, setState] = useState(() => ({
    playing: false,
    loading: false,
    error: null as string | null,
    volume: readStoredVolume(),
    muted: false,
  }));
  const [savedUrls, setSavedUrls] = useState<Set<string>>(() => new Set());
  const savedUrlsRef = useRef(savedUrls);
  useEffect(() => {
    savedUrlsRef.current = savedUrls;
  }, [savedUrls]);

  // Learn which tracks are already saved, and hear about new saves.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    const load = () =>
      void getAudioCacheInfo().then((info) => {
        if (!cancelled && info) setSavedUrls(new Set(info.urls));
      });
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "track-saved") setSavedUrls((prev) => new Set(prev).add(e.data.url));
      if (e.data?.type === "audio-cache-info" && e.data.tracks === 0) setSavedUrls(new Set());
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    if (navigator.serviceWorker.controller) load();
    else navigator.serviceWorker.addEventListener("controllerchange", load, { once: true });
    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);

  const [time, setTime] = useState<PlayerTime>({ currentTime: 0, duration: 0, buffered: 0 });

  const commitQueue = useCallback((q: Queue) => {
    queueRef.current = q;
    setQueue(q);
  }, []);

  const clearStallTimer = () => {
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    stallTimerRef.current = null;
  };

  /** Buffer the upcoming track in the standby element. */
  const preloadUpcoming = useCallback(() => {
    const standby = standbyRef.current;
    if (!standby) return;
    const q = queueRef.current;
    const pos = repeatRef.current === "one" ? null : stepPos(q, 1, repeatRef.current);
    const nextTrack = pos === null ? null : q.tracks[q.order[pos]];
    const url = nextTrack?.preview_url;
    if (url && standby.getAttribute("src") !== url) {
      standby.src = url;
      standby.load();
    }
  }, []);

  /** Make `url` play on the active element, swapping in the standby if it already buffered it. */
  const startUrl = useCallback(
    (url: string, autoplay: boolean, gesture: boolean) => {
      let audio = activeRef.current!;
      const standby = standbyRef.current!;
      clearStallTimer();
      retryRef.current.count = 0;

      const canSwap = gesture || unlockedRef.current.has(standby);
      if (audio.getAttribute("src") !== url && standby.getAttribute("src") === url && canSwap) {
        // Swap: the standby already has this track buffered.
        audio.pause();
        activeRef.current = standby;
        standbyRef.current = audio;
        audio = standby;
        audio.currentTime = 0;
      } else if (audio.getAttribute("src") !== url) {
        audio.src = url;
      } else {
        audio.currentTime = 0;
      }
      audio.volume = volumeRef.current.volume;
      audio.muted = volumeRef.current.muted;

      wantPlayRef.current = autoplay;
      setTime({ currentTime: 0, duration: Number.isFinite(audio.duration) ? audio.duration : 0, buffered: 0 });
      setState((s) => ({ ...s, loading: autoplay && audio.readyState < 3, error: null }));
      if (autoplay) {
        audio.play().catch((e: Error) => {
          if (e.name === "AbortError") return; // superseded by another play request
          wantPlayRef.current = false;
          setState((s) => ({ ...s, loading: false, playing: false }));
        });
      }
      // The upcoming track is buffered once this one can play through (see
      // "canplaythrough"), so the two downloads don't compete on slow networks.
      if (audio.readyState >= 4) preloadUpcoming();
    },
    [preloadUpcoming],
  );

  /** Load the track at the queue's current position. */
  const loadCurrent = useCallback(
    (autoplay = true, gesture = true) => {
      const audio = activeRef.current;
      const track = currentOf(queueRef.current);
      if (!audio || !track) return;
      listened.current = { ms: 0, last: 0, recorded: false, saved: false };

      if (!track.preview_url) {
        // No playback source: show the track, never fake playback.
        wantPlayRef.current = false;
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
        setTime({ currentTime: 0, duration: 0, buffered: 0 });
        setState((s) => ({ ...s, playing: false, loading: false, error: null }));
        return;
      }
      startUrl(track.preview_url, autoplay, gesture);
    },
    [startUrl],
  );

  /** Move through the queue, skipping tracks that have nothing to play. */
  const step = useCallback(
    (dir: 1 | -1, auto: boolean) => {
      const q = queueRef.current;
      if (q.order.length === 0) return;
      const pos = stepPos(q, dir, repeatRef.current);
      if (pos === null) {
        const audio = activeRef.current;
        if (audio) {
          // End of the queue: stop on the last track, like Spotify.
          if (dir === 1 && auto) {
            wantPlayRef.current = false;
            audio.pause();
          }
          audio.currentTime = 0;
        }
        return;
      }
      commitQueue({ ...q, pos });
      loadCurrent(true, !auto);
    },
    [commitQueue, loadCurrent],
  );

  const preloadRef = useRef(preloadUpcoming);
  useEffect(() => {
    preloadRef.current = preloadUpcoming;
  }, [preloadUpcoming]);

  // Event handlers below are bound once; route them to the latest `step`.
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  /** Reconnect after a network error or long stall and resume at the same position. */
  const recover = useCallback((reason: string) => {
    const audio = activeRef.current;
    const track = currentOf(queueRef.current);
    if (!audio || !track?.preview_url) return;
    const r = retryRef.current;
    if (r.count >= MAX_RETRIES) {
      wantPlayRef.current = false;
      setState((s) => ({ ...s, playing: false, loading: false, error: "Playback stopped: the connection is too unstable. Press play to retry." }));
      return;
    }
    r.count += 1;
    const at = audio.currentTime;
    const resume = wantPlayRef.current;
    if (r.timer) clearTimeout(r.timer);
    setState((s) => ({ ...s, loading: true, error: null }));
    r.timer = setTimeout(
      () => {
        if (!navigator.onLine) return; // the "online" listener resumes us
        const onMeta = () => {
          audio.removeEventListener("loadedmetadata", onMeta);
          try {
            audio.currentTime = at;
          } catch {}
          if (resume) audio.play().catch(() => {});
        };
        audio.addEventListener("loadedmetadata", onMeta);
        // Cache-busting is unnecessary; reassigning src opens a fresh connection.
        audio.src = track.preview_url!;
        audio.load();
      },
      reason === "error" ? 400 * 2 ** (r.count - 1) : 0,
    );
  }, []);
  const recoverRef = useRef(recover);
  useEffect(() => {
    recoverRef.current = recover;
  }, [recover]);

  // Audio elements + events (created once).
  useEffect(() => {
    const a = makeAudio(volumeRef.current.volume);
    const b = makeAudio(volumeRef.current.volume);
    activeRef.current = a;
    standbyRef.current = b;

    const isActive = (e: Event) => e.currentTarget === activeRef.current;

    const report = (event: "preview_30s" | "preview_complete") => {
      const t = currentOf(queueRef.current);
      if (!t || listened.current.recorded) return;
      listened.current.recorded = true;
      void recordListen({ songId: t.songId, providerId: t.providerId, event, listenedMs: listened.current.ms }).catch(() => {});
    };

    const bufferedEnd = (audio: HTMLAudioElement) => {
      const b = audio.buffered;
      for (let i = b.length - 1; i >= 0; i--) {
        if (b.start(i) <= audio.currentTime + 0.5) return b.end(i);
      }
      return 0;
    };

    const onTime = (e: Event) => {
      if (!isActive(e)) return;
      const audio = e.currentTarget as HTMLAudioElement;
      const now = audio.currentTime;
      const delta = now - listened.current.last;
      // Count only continuous playback; seeks produce large jumps.
      if (delta > 0 && delta < 1.5 && !audio.paused) listened.current.ms += delta * 1000;
      listened.current.last = now;
      if (listened.current.ms >= LISTEN_THRESHOLD_MS) report("preview_30s");
      // Listened for a bit: keep a copy on the device so replays are instant.
      if (listened.current.ms > 10_000 && !listened.current.saved) {
        listened.current.saved = true;
        const t = currentOf(queueRef.current);
        if (t?.preview_url && !savedUrlsRef.current.has(t.preview_url)) saveTrackForOffline(t.preview_url);
      }
      // Fallback for slow links where "canplaythrough" never fires.
      if (listened.current.ms > 10_000) preloadRef.current();
      if (delta > 0) {
        clearStallTimer();
        retryRef.current.count = 0;
      }
      setTime({ currentTime: now, duration: Number.isFinite(audio.duration) ? audio.duration : 0, buffered: bufferedEnd(audio) });
    };
    const onProgress = (e: Event) => {
      if (!isActive(e)) return;
      const audio = e.currentTarget as HTMLAudioElement;
      setTime((t) => ({ ...t, buffered: bufferedEnd(audio) }));
    };
    const onEnded = (e: Event) => {
      if (!isActive(e)) return;
      const audio = e.currentTarget as HTMLAudioElement;
      if (listened.current.ms >= COMPLETE_MIN_MS) report("preview_complete");
      if (repeatRef.current === "one") {
        listened.current = { ms: 0, last: 0, recorded: false, saved: false };
        audio.currentTime = 0;
        void audio.play().catch(() => {});
        return;
      }
      stepRef.current(1, true);
    };
    const onPlay = (e: Event) => isActive(e) && setState((s) => ({ ...s, playing: true }));
    const onPause = (e: Event) => {
      if (!isActive(e)) return;
      clearStallTimer();
      setState((s) => ({ ...s, playing: false, loading: false }));
    };
    const onWaiting = (e: Event) => {
      if (!isActive(e)) return;
      setState((s) => ({ ...s, loading: true }));
      // Spotify-style resilience: if rebuffering takes too long, reconnect.
      clearStallTimer();
      stallTimerRef.current = setTimeout(() => recoverRef.current("stall"), STALL_TIMEOUT_MS);
    };
    const onPlaying = (e: Event) => {
      unlockedRef.current.add(e.currentTarget as HTMLAudioElement);
      if (!isActive(e)) return;
      clearStallTimer();
      setState((s) => ({ ...s, loading: false, playing: true, error: null }));
    };
    const onCanPlay = (e: Event) => {
      if (!isActive(e)) return;
      // Read now: `e.currentTarget` is null once dispatch ends, and state
      // updaters run later.
      const paused = (e.currentTarget as HTMLAudioElement).paused;
      if (paused && !wantPlayRef.current) setState((s) => (s.loading ? { ...s, loading: false } : s));
    };
    const onMeta = (e: Event) => {
      if (!isActive(e)) return;
      const audio = e.currentTarget as HTMLAudioElement;
      setTime((t) => ({ ...t, duration: Number.isFinite(audio.duration) ? audio.duration : 0 }));
    };
    const onError = (e: Event) => {
      const audio = e.currentTarget as HTMLAudioElement;
      if (!audio.getAttribute("src")) return;
      if (!isActive(e)) {
        // A failed preload is harmless; the track loads normally when played.
        audio.removeAttribute("src");
        return;
      }
      const code = audio.error?.code;
      if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED || code === MediaError.MEDIA_ERR_DECODE) {
        // Unplayable file: skip it rather than stopping the music.
        setState((s) => ({ ...s, error: "This track couldn't be played — skipping." }));
        if (wantPlayRef.current) setTimeout(() => stepRef.current(1, true), 800);
        else setState((s) => ({ ...s, loading: false, playing: false }));
        return;
      }
      recoverRef.current("error");
    };
    const onCanPlayThrough = (e: Event) => {
      if (isActive(e)) preloadRef.current();
    };
    const onSeeked = (e: Event) => {
      if (!isActive(e)) return;
      listened.current.last = (e.currentTarget as HTMLAudioElement).currentTime;
    };

    const events: [string, (e: Event) => void][] = [
      ["timeupdate", onTime],
      ["progress", onProgress],
      ["ended", onEnded],
      ["play", onPlay],
      ["pause", onPause],
      ["waiting", onWaiting],
      ["playing", onPlaying],
      ["canplay", onCanPlay],
      ["canplaythrough", onCanPlayThrough],
      ["loadedmetadata", onMeta],
      ["durationchange", onMeta],
      ["error", onError],
      ["seeked", onSeeked],
    ];
    for (const el of [a, b]) events.forEach(([name, h]) => el.addEventListener(name, h));

    // Back online after a drop: pick up where we left off.
    const onOnline = () => {
      if (wantPlayRef.current && activeRef.current?.paused) {
        retryRef.current.count = 0;
        recoverRef.current("online");
      }
    };
    window.addEventListener("online", onOnline);

    return () => {
      window.removeEventListener("online", onOnline);
      clearStallTimer();
      for (const el of [a, b]) {
        el.pause();
        el.removeAttribute("src");
        events.forEach(([name, h]) => el.removeEventListener(name, h));
      }
    };
  }, []);

  const buildQueue = useCallback((tracks: PlayableTrack[], startIdx: number, source: string | null, shuffleOn: boolean): Queue => {
    const idx = tracks.map((_, i) => i);
    if (shuffleOn) {
      const rest = shuffled(idx.filter((i) => i !== startIdx));
      return { tracks, order: [startIdx, ...rest], pos: 0, source };
    }
    return { tracks, order: idx, pos: startIdx, source };
  }, []);

  const play = useCallback(
    (track: PlayableTrack, list?: PlayableTrack[], source: string | null = null) => {
      const audio = activeRef.current;
      if (!audio) return;
      const current = currentOf(queueRef.current);

      // Same track: resume instead of restarting.
      if (current?.providerId === track.providerId && track.preview_url && audio.getAttribute("src")) {
        if (list && source !== queueRef.current.source) {
          const tracks = list.some((t) => t.providerId === track.providerId) ? list : [track];
          const start = Math.max(0, tracks.findIndex((t) => t.providerId === track.providerId));
          commitQueue(buildQueue(tracks, start, source, shuffleRef.current));
          preloadUpcoming();
        }
        if (audio.ended) audio.currentTime = 0;
        wantPlayRef.current = true;
        audio.play().catch(() => setState((s) => ({ ...s, loading: false, playing: false })));
        return;
      }

      const tracks = list?.some((t) => t.providerId === track.providerId) ? list : [track];
      const start = Math.max(0, tracks.findIndex((t) => t.providerId === track.providerId));
      commitQueue(buildQueue(tracks, start, list ? source : null, shuffleRef.current));
      loadCurrent(true);
    },
    [buildQueue, commitQueue, loadCurrent, preloadUpcoming],
  );

  const playList = useCallback(
    (tracks: PlayableTrack[], source: string | null = null, opts?: { shuffle?: boolean }) => {
      const playable = tracks.filter((t) => t.preview_url);
      if (playable.length === 0) return;
      if (opts?.shuffle !== undefined) {
        shuffleRef.current = opts.shuffle;
        setShuffle(opts.shuffle);
      }
      const startTrack = shuffleRef.current ? playable[Math.floor(Math.random() * playable.length)] : playable[0];
      const start = tracks.findIndex((t) => t.providerId === startTrack.providerId);
      commitQueue(buildQueue(tracks, start, source, shuffleRef.current));
      loadCurrent(true);
    },
    [buildQueue, commitQueue, loadCurrent],
  );

  const prime = useCallback((track: PlayableTrack) => {
    const active = activeRef.current;
    const standby = standbyRef.current;
    const url = track.preview_url;
    if (!active || !standby || !url) return;
    if (active.getAttribute("src") === url || standby.getAttribute("src") === url) return;
    standby.src = url;
    standby.load();
  }, []);

  const toggle = useCallback(() => {
    const audio = activeRef.current;
    const t = currentOf(queueRef.current);
    if (!audio || !t?.preview_url) return;
    if (audio.paused) {
      if (audio.ended) audio.currentTime = 0;
      wantPlayRef.current = true;
      retryRef.current.count = 0;
      if (audio.error) {
        recover("error");
        return;
      }
      setState((s) => ({ ...s, error: null, loading: audio.readyState < 3 }));
      audio.play().catch(() => setState((s) => ({ ...s, loading: false, playing: false })));
    } else {
      wantPlayRef.current = false;
      audio.pause();
    }
  }, [recover]);

  const next = useCallback(() => step(1, false), [step]);

  const previous = useCallback(() => {
    const audio = activeRef.current;
    // Like Spotify: restart the song unless we're right at its start.
    if (audio && audio.currentTime > RESTART_THRESHOLD_S) {
      audio.currentTime = 0;
      return;
    }
    step(-1, false);
  }, [step]);

  const toggleShuffle = useCallback(() => {
    const on = !shuffleRef.current;
    shuffleRef.current = on;
    setShuffle(on);
    const q = queueRef.current;
    if (q.order.length === 0) return;
    const cur = q.order[q.pos];
    if (on) {
      const rest = shuffled(q.tracks.map((_, i) => i).filter((i) => i !== cur));
      commitQueue({ ...q, order: [cur, ...rest], pos: 0 });
    } else {
      commitQueue({ ...q, order: q.tracks.map((_, i) => i), pos: cur });
    }
    preloadUpcoming();
  }, [commitQueue, preloadUpcoming]);

  const cycleRepeat = useCallback(() => {
    const nextMode: RepeatMode = repeatRef.current === "off" ? "all" : repeatRef.current === "all" ? "one" : "off";
    repeatRef.current = nextMode;
    setRepeat(nextMode);
    preloadUpcoming();
  }, [preloadUpcoming]);

  const jumpTo = useCallback(
    (providerId: string) => {
      const q = queueRef.current;
      const pos = q.order.findIndex((i) => q.tracks[i]?.providerId === providerId);
      if (pos < 0) return;
      commitQueue({ ...q, pos });
      loadCurrent(true);
    },
    [commitQueue, loadCurrent],
  );

  const seek = useCallback((seconds: number) => {
    const audio = activeRef.current;
    if (!audio || !Number.isFinite(seconds)) return;
    const target = Math.max(0, Math.min(seconds, audio.duration || seconds));
    // fastSeek is near-instant where supported (Safari/Firefox).
    if (typeof audio.fastSeek === "function" && Math.abs(target - audio.currentTime) > 5) audio.fastSeek(target);
    else audio.currentTime = target;
    setTime((t) => ({ ...t, currentTime: target }));
  }, []);

  const setVolume = useCallback((v: number) => {
    volumeRef.current = { volume: v, muted: v === 0 };
    for (const el of [activeRef.current, standbyRef.current]) {
      if (!el) continue;
      el.volume = v;
      el.muted = v === 0;
    }
    setState((s) => ({ ...s, volume: v, muted: v === 0 }));
    try {
      localStorage.setItem("wl-volume", String(v));
    } catch {}
  }, []);

  const toggleMute = useCallback(() => {
    const muted = !volumeRef.current.muted;
    volumeRef.current = { ...volumeRef.current, muted };
    for (const el of [activeRef.current, standbyRef.current]) if (el) el.muted = muted;
    setState((s) => ({ ...s, muted }));
  }, []);

  const track = currentOf(queue);

  // Lock-screen / hardware media keys.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator) || !track) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: queue.source ?? undefined,
      artwork: track.artwork_url ? [{ src: track.artwork_url, sizes: "600x600", type: "image/jpeg" }] : [],
    });
    const handlers: [MediaSessionAction, (d: MediaSessionActionDetails) => void][] = [
      ["play", () => toggle()],
      ["pause", () => toggle()],
      ["nexttrack", () => next()],
      ["previoustrack", () => previous()],
      ["seekto", (d) => d.seekTime !== undefined && seek(d.seekTime)],
    ];
    handlers.forEach(([a, h]) => {
      try {
        navigator.mediaSession.setActionHandler(a, h);
      } catch {}
    });
  }, [track, queue.source, toggle, next, previous, seek]);

  // Space toggles play/pause when not typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.code !== "Space" || e.repeat || !currentOf(queueRef.current)) return;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(el.tagName))) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const api = useMemo<PlayerApi>(() => {
    const n = queue.order.length;
    const after = queue.order.slice(queue.pos + 1);
    const wrapped = repeat === "all" ? queue.order.slice(0, queue.pos) : [];
    const upNext = [...after, ...wrapped].map((i) => queue.tracks[i]).filter((t) => t?.preview_url);
    return {
      ...state,
      track,
      shuffle,
      repeat,
      source: queue.source,
      savedOffline: Boolean(track?.preview_url && savedUrls.has(track.preview_url)),
      upNext,
      hasNext: upNext.length > 0,
      hasPrevious: n > 0,
      play,
      playList,
      prime,
      toggle,
      next,
      previous,
      toggleShuffle,
      cycleRepeat,
      jumpTo,
      seek,
      setVolume,
      toggleMute,
      isCurrent: (id: string) => track?.providerId === id,
      isSource: (s: string) => queue.source === s,
    };
  }, [state, track, shuffle, repeat, queue, savedUrls, play, playList, prime, toggle, next, previous, toggleShuffle, cycleRepeat, jumpTo, seek, setVolume, toggleMute]);

  return (
    <PlayerContext value={api}>
      <PlayerTimeContext value={time}>{children}</PlayerTimeContext>
    </PlayerContext>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside PlayerProvider");
  return ctx;
}

/** Current position/duration/buffered — subscribe only where a progress bar is shown. */
export function usePlayerTime() {
  return useContext(PlayerTimeContext);
}
