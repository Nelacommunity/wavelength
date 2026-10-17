"use client";

import { ExternalLink } from "lucide-react";
import { recordListen } from "@/lib/actions/songs";
import { PROVIDER_LABEL } from "@/lib/constants";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Opens the song on its streaming service. Logged as an outbound click, never as a listen. */
export function ListenExternally({
  song,
  variant = "outline",
  compact,
  className,
}: {
  song: { id?: string; provider: string; provider_id: string; external_url: string | null };
  variant?: "outline" | "ghost" | "secondary";
  compact?: boolean;
  className?: string;
}) {
  if (!song.external_url) return null;
  const label = `Listen on ${PROVIDER_LABEL[song.provider] ?? "streaming service"}`;
  return (
    <a
      href={song.external_url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        if (song.id) void recordListen({ songId: song.id, event: "external_open", listenedMs: 0 }).catch(() => {});
      }}
      aria-label={label}
      className={compact ? cn(buttonClass("ghost", "icon"), className) : buttonClass(variant, "md", className)}
    >
      {!compact && label}
      <ExternalLink className="h-4 w-4" aria-hidden />
    </a>
  );
}
