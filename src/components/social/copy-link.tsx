"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** Clipboard API needs a secure context (https or localhost); fall back to a hidden textarea. */
function legacyCopy(text: string) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

export function CopyLinkButton({
  path,
  label = "Copy link",
  title,
  className,
  iconOnly,
}: {
  path: string;
  label?: string;
  /** Used as the title in the native share sheet. */
  title?: string;
  className?: string;
  iconOnly?: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [manualUrl, setManualUrl] = useState<string | null>(null);

  const flash = (s: "copied" | "failed") => {
    setStatus(s);
    setTimeout(() => setStatus("idle"), 2200);
  };

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const url = new URL(path, window.location.origin).toString();
          // Phones: open the system share sheet (WhatsApp, Messages, …).
          if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
            try {
              await navigator.share({ url, title });
              return;
            } catch (err) {
              if ((err as Error).name === "AbortError") return; // user closed the sheet
            }
          }
          try {
            if (!navigator.clipboard) throw new Error("no clipboard");
            await navigator.clipboard.writeText(url);
            flash("copied");
          } catch {
            if (legacyCopy(url)) flash("copied");
            else {
              setManualUrl(url);
              flash("failed");
            }
          }
        }}
        aria-label={label}
        className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg", className)}
      >
        {status === "copied" ? <Check className="h-4 w-4 text-up" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
        {!iconOnly && <span>{status === "copied" ? "Copied" : label}</span>}
        <span className="sr-only" aria-live="polite">{status === "copied" ? "Link copied" : status === "failed" ? "Couldn't copy the link" : ""}</span>
      </button>
      {manualUrl && (
        <span role="dialog" aria-label="Copy this link" className="absolute left-0 top-full z-40 mt-2 w-72 rounded-xl border border-line-strong bg-surface-2 p-3 text-xs shadow-2xl">
          <span className="mb-1.5 block text-muted">Your browser blocked copying. Select and copy the link:</span>
          <input readOnly value={manualUrl} onFocus={(e) => e.currentTarget.select()} autoFocus className="w-full rounded-lg bg-surface-3 px-2 py-1.5 text-fg" />
          <button type="button" onClick={() => setManualUrl(null)} className="mt-2 font-semibold text-fg hover:underline">
            Done
          </button>
        </span>
      )}
    </span>
  );
}
