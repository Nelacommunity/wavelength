"use client";

// Client side of the service worker's saved-music cache (see public/sw.js).
// Music is stored in Cache Storage, not localStorage: localStorage holds ~5 MB
// of text, while Cache Storage holds hundreds of MB of binary audio.

export type AudioCacheInfo = { tracks: number; bytes: number; urls: string[] };

function controller() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.controller;
}

export function audioCacheSupported() {
  return Boolean(controller());
}

let persistAsked = false;

/** Ask the service worker to keep a full copy of a track on this device. */
export function saveTrackForOffline(url: string) {
  const sw = controller();
  if (!sw || !url.includes("/storage/v1/object/public/tracks/")) return;
  sw.postMessage({ type: "save-track", url });
  if (!persistAsked && navigator.storage?.persist) {
    persistAsked = true;
    // Best effort: ask the browser not to evict saved music under storage pressure.
    void navigator.storage.persist().catch(() => {});
  }
}

function request(type: "audio-cache-info" | "audio-cache-clear"): Promise<AudioCacheInfo | null> {
  const sw = controller();
  if (!sw) return Promise.resolve(null);
  return new Promise((resolve) => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type !== "audio-cache-info") return;
      navigator.serviceWorker.removeEventListener("message", onMessage);
      resolve({ tracks: e.data.tracks, bytes: e.data.bytes, urls: e.data.urls ?? [] });
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    sw.postMessage({ type });
    setTimeout(() => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
      resolve(null);
    }, 4000);
  });
}

export const getAudioCacheInfo = () => request("audio-cache-info");
export const clearAudioCache = () => request("audio-cache-clear");
