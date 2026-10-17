"use client";

import { Loader2, Search, Send, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { createPost, type PostState } from "@/lib/actions/posts";
import { Artwork } from "@/components/ui/artwork";
import { Avatar } from "@/components/ui/avatar";
import { PlayButton } from "@/components/music/play-button";
import { toPlayable } from "@/lib/playable";
import type { CatalogTrack, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX = 500;

type SharedAlbum = { id: string; title: string; cover_url: string | null; artist: string; trackCount: number };

export function ShareComposer({ initial, user, album = null }: { initial: CatalogTrack | null; user: Profile; album?: SharedAlbum | null }) {
  const [selected, setSelected] = useState<CatalogTrack | null>(initial);
  const [caption, setCaption] = useState("");
  const [state, action, pending] = useActionState<PostState, FormData>(createPost, undefined);

  return (
    <div className="space-y-5">
      {album ? (
        <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-3">
          <Artwork src={album.cover_url} alt="" size={80} className="h-20 w-20" rounded="rounded-lg" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-accent">Sharing album</div>
            <div className="truncate font-semibold">{album.title}</div>
            <div className="truncate text-sm text-muted">
              {album.artist} · {album.trackCount} {album.trackCount === 1 ? "track" : "tracks"}
            </div>
          </div>
        </div>
      ) : !selected ? (
        <TrackPicker onPick={setSelected} />
      ) : (
        <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-3">
          <Artwork src={selected.artwork_url} alt="" size={80} className="h-20 w-20" rounded="rounded-lg" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-accent">Sharing</div>
            <div className="truncate font-semibold">{selected.title}</div>
            <div className="truncate text-sm text-muted">{selected.artist}</div>
          </div>
          <PlayButton track={toPlayable(selected)} />
          <button
            type="button"
            onClick={() => setSelected(null)}
            aria-label="Choose a different song"
            className="rounded-full p-2 text-muted hover:bg-surface-2 hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <form action={action} className="rounded-2xl border border-line bg-surface p-4">
        {album ? <input type="hidden" name="albumId" value={album.id} /> : null}
        {!album && selected?.id ? <input type="hidden" name="songId" value={selected.id} /> : null}
        <div className="flex gap-3">
          <Avatar user={user} size={40} />
          <div className="flex-1">
            <label htmlFor="caption" className="sr-only">Caption</label>
            <textarea
              id="caption"
              name="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, MAX))}
              rows={4}
              placeholder={album ? `Tell people about “${album.title}”…` : selected ? `What makes “${selected.title}” special?` : "Pick a song first, then add a caption…"}
              className="w-full resize-none bg-transparent text-[15px] leading-relaxed placeholder:text-subtle focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <span className={cn("text-xs tabular-nums", caption.length > MAX - 40 ? "text-warn" : "text-subtle")}>
            {caption.length}/{MAX}
          </span>
          <button
            type="submit"
            disabled={(!selected && !album) || pending}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-black transition-opacity disabled:opacity-40"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {pending ? "Posting…" : "Post"}
          </button>
        </div>
        {state?.error && (
          <p role="alert" className="mt-2 text-sm text-down">
            {state.error}
          </p>
        )}
      </form>
    </div>
  );
}

function TrackPicker({ onPick }: { onPick: (t: CatalogTrack) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CatalogTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const active = q.trim().length >= 2;
  const shown = active ? results : [];
  const shownError = active ? error : null;

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Search failed");
        setResults(json.tracks);
        setError(null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={100}
          placeholder="Search for a song to share"
          aria-label="Search for a song to share"
          className="h-11 w-full rounded-xl bg-surface-2 pl-10 pr-10 text-[15px] placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent"
        />
        {loading && active && <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-subtle" />}
      </div>
      {shownError && <p role="alert" className="px-1 pt-3 text-sm text-down">{shownError}</p>}
      {!shownError && active && !loading && shown.length === 0 && (
        <p className="px-1 pt-3 text-sm text-muted">No songs found. Try another search.</p>
      )}
      {shown.length > 0 && (
        <ul className="mt-2 max-h-[420px] overflow-y-auto">
          {shown.map((t) => (
            <li key={t.provider_id}>
              <button
                type="button"
                onClick={() => onPick(t)}
                className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-surface-2"
              >
                <Artwork src={t.artwork_url} alt="" size={44} className="h-11 w-11" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{t.title}</span>
                  <span className="block truncate text-xs text-muted">
                    {t.artist}
                    {t.album ? ` · ${t.album}` : ""}
                  </span>
                </span>
                <span className="text-xs font-semibold text-accent">Select</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length < 2 && <p className="px-1 pt-3 text-xs text-subtle">Search songs uploaded on Wavelength.</p>}
    </div>
  );
}
