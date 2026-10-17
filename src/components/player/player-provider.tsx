"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { recordListen } from "@/lib/actions/songs";

export type PlayableTrack = {
  songId?: string;
  providerId: string;
  title: string;
  artist: string;
  artwork_url: string | null;
  /** Playback source: an official preview, or the full upload. */
  preview_url: string | null;
  external_url: string | null;
  /** True for full-length tracks uploaded to Wavelength. */
  fullTrack?: boolean;
};

export type RepeatMode = "off" | "all" | "one";

type PlayerState = {
  track: PlayableTrack | null;
  playing: boolean;
  loading: boolean;
  error: string | null;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  /** Where the current queue came from, e.g. "Album · Midnight Tapes". */
  source: string | null;
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

const PlayerContext = createContext<PlayerApi | null>(null);

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

type Queue = {
  tracks: PlayableTrack[];
  /** Play order: a permutation of indexes into `tracks`. */
  order: number[];
  pos: number;
  source: string | null;
};

const EMPTY_QUEUE: Queue = { tracks: [], order: [], pos: 0, source: null };

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const listened = useRef({ ms: 0, last: 0, recorded: false });
  const queueRef = useRef<Queue>(EMPTY_QUEUE);
  const shuffleRef = useRef(false);
  const repeatRef = useRef<RepeatMode>("off");

  const [queue, setQueue] = useState<Queue>(EMPTY_QUEUE);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [state, setState] = useState(() => ({
    playing: false,
    loading: false,
    error: null as string | null,
    currentTime: 0,
    duration: 0,
    volume: readStoredVolume(),
    muted: false,
  }));

  const commitQueue = useCallback((q: Queue) => {
    queueRef.current = q;
    setQueue(q);
  }, []);

  const currentOf = (q: Queue) => (q.order.length ? q.tracks[q.order[q.pos]] ?? null : null);

  /** Load the track at the queue's current position and start playback. */
  const loadCurrent = useCallback((autoplay = true) => {
    const audio = audioRef.current;
    const track = currentOf(queueRef.current);
    if (!audio || !track) return;
    listened.current = { ms: 0, last: 0, recorded: false };

    if (!track.preview_url) {
      // No playback source: show the track, never fake playback.
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      setState((s) => ({ ...s, playing: false, loading: false, error: null, currentTime: 0, duration: 0 }));
      return;
    }
    audio.src = track.preview_url;
    setState((s) => ({ ...s, currentTime: 0, duration: 0, loading: autoplay, error: null }));
    if (autoplay) audio.play().catch(() => setState((s) => ({ ...s, loading: false, playing: false })));
  }, []);

  /** Move through the queue, skipping tracks that have nothing to play. */
  const step = useCallback(
    (dir: 1 | -1, auto: boolean) => {
      const q = queueRef.current;
      const n = q.order.length;
      if (n === 0) return;
      let pos = q.pos;
      for (let tries = 0; tries < n; tries++) {
        pos += dir;
        if (pos >= n) {
          if (repeatRef.current !== "all") {
            // End of the queue: stop on the last track, like Spotify.
            if (auto) {
              audioRef.current?.pause();
              if (audioRef.current) audioRef.current.currentTime = 0;
            }
            return;
          }
          pos = 0;
        }
        if (pos < 0) {
          if (repeatRef.current !== "all") {
            if (audioRef.current) audioRef.current.currentTime = 0;
            return;
          }
          pos = n - 1;
        }
        if (q.tracks[q.order[pos]]?.preview_url) break;
      }
      commitQueue({ ...q, pos });
      loadCurrent(true);
    },
    [commitQueue, loadCurrent],
  );

  // Event handlers below are bound once; route them to the latest `step`.
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  // Audio element + events (created once).
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.volume = readStoredVolume();
    audioRef.current = audio;

    const report = (event: "preview_30s" | "preview_complete") => {
      const t = currentOf(queueRef.current);
      if (!t || listened.current.recorded) return;
      listened.current.recorded = true;
      void recordListen({ songId: t.songId, providerId: t.providerId, event, listenedMs: listened.current.ms }).catch(() => {});
    };

    const onTime = () => {
      const now = audio.currentTime;
      const delta = now - listened.current.last;
      // Count only continuous playback; seeks produce large jumps.
      if (delta > 0 && delta < 1.5 && !audio.paused) listened.current.ms += delta * 1000;
      listened.current.last = now;
      if (listened.current.ms >= LISTEN_THRESHOLD_MS) report("preview_30s");
      setState((s) => ({ ...s, currentTime: now }));
    };
    const onEnded = () => {
      if (listened.current.ms >= COMPLETE_MIN_MS) report("preview_complete");
      if (repeatRef.current === "one") {
        listened.current = { ms: 0, last: 0, recorded: false };
        audio.currentTime = 0;
        void audio.play().catch(() => {});
        return;
      }
      setState((s) => ({ ...s, playing: false }));
      stepRef.current(1, true);
    };
    const onPlay = () => setState((s) => ({ ...s, playing: true }));
    const onPause = () => setState((s) => ({ ...s, playing: false }));
    const onWaiting = () => setState((s) => ({ ...s, loading: true }));
    const onPlaying = () => setState((s) => ({ ...s, loading: false, error: null }));
    const onMeta = () => setState((s) => ({ ...s, duration: Number.isFinite(audio.duration) ? audio.duration : 0 }));
    const onError = () => {
      if (!audio.getAttribute("src")) return;
      setState((s) => ({ ...s, playing: false, loading: false, error: "This track could not be played." }));
    };
    const onSeeked = () => {
      listened.current.last = audio.currentTime;
    };

    const events: [string, EventListener][] = [
      ["timeupdate", onTime],
      ["ended", onEnded],
      ["play", onPlay],
      ["pause", onPause],
      ["waiting", onWaiting],
      ["playing", onPlaying],
      ["loadedmetadata", onMeta],
      ["error", onError],
      ["seeked", onSeeked],
    ];
    events.forEach(([e, h]) => audio.addEventListener(e, h));
    return () => {
      audio.pause();
      audio.removeAttribute("src");
      events.forEach(([e, h]) => audio.removeEventListener(e, h));
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
      const audio = audioRef.current;
      if (!audio) return;
      const current = currentOf(queueRef.current);

      // Same track: resume instead of restarting.
      if (current?.providerId === track.providerId && track.preview_url && audio.getAttribute("src")) {
        if (list && source !== queueRef.current.source) {
          // Re-anchor the queue to the new list without interrupting playback.
          const tracks = list.some((t) => t.providerId === track.providerId) ? list : [track];
          const start = Math.max(0, tracks.findIndex((t) => t.providerId === track.providerId));
          commitQueue(buildQueue(tracks, start, source, shuffleRef.current));
        }
        if (audio.ended) audio.currentTime = 0;
        audio.play().catch(() => setState((s) => ({ ...s, loading: false, playing: false })));
        return;
      }

      const tracks = list?.some((t) => t.providerId === track.providerId) ? list : [track];
      const start = Math.max(0, tracks.findIndex((t) => t.providerId === track.providerId));
      commitQueue(buildQueue(tracks, start, list ? source : null, shuffleRef.current));
      loadCurrent(true);
    },
    [buildQueue, commitQueue, loadCurrent],
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

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    const t = currentOf(queueRef.current);
    if (!audio || !t?.preview_url) return;
    if (audio.paused) {
      if (audio.ended) audio.currentTime = 0;
      audio.play().catch(() => setState((s) => ({ ...s, loading: false, playing: false })));
    } else audio.pause();
  }, []);

  const next = useCallback(() => step(1, false), [step]);

  const previous = useCallback(() => {
    const audio = audioRef.current;
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
  }, [commitQueue]);

  const cycleRepeat = useCallback(() => {
    const nextMode: RepeatMode = repeatRef.current === "off" ? "all" : repeatRef.current === "all" ? "one" : "off";
    repeatRef.current = nextMode;
    setRepeat(nextMode);
  }, []);

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
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(seconds)) return;
    audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || seconds));
  }, []);

  const setVolume = useCallback((v: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = v;
    audio.muted = v === 0;
    setState((s) => ({ ...s, volume: v, muted: v === 0 }));
    try {
      localStorage.setItem("wl-volume", String(v));
    } catch {}
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setState((s) => ({ ...s, muted: audio.muted }));
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
    const handlers: [MediaSessionAction, () => void][] = [
      ["play", toggle],
      ["pause", toggle],
      ["nexttrack", next],
      ["previoustrack", previous],
    ];
    handlers.forEach(([a, h]) => {
      try {
        navigator.mediaSession.setActionHandler(a, h);
      } catch {}
    });
  }, [track, queue.source, toggle, next, previous]);

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
      upNext,
      hasNext: upNext.length > 0,
      hasPrevious: n > 0,
      play,
      playList,
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
  }, [state, track, shuffle, repeat, queue, play, playList, toggle, next, previous, toggleShuffle, cycleRepeat, jumpTo, seek, setVolume, toggleMute]);

  return <PlayerContext value={api}>{children}</PlayerContext>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside PlayerProvider");
  return ctx;
}
