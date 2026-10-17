"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { setFavorite } from "@/lib/actions/songs";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  songId,
  providerId,
  initial,
  signedIn,
  className,
  withLabel,
}: {
  songId?: string;
  providerId: string;
  initial: boolean;
  signedIn: boolean;
  className?: string;
  withLabel?: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [optimistic, setOptimistic] = useOptimistic(saved);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={optimistic}
      aria-label={optimistic ? "Remove from favorites" : "Add to favorites"}
      title={error ?? (optimistic ? "Remove from favorites" : "Add to favorites")}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!signedIn) {
          router.push(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
          return;
        }
        const next = !saved;
        start(async () => {
          setOptimistic(next);
          const res = await setFavorite({ songId, providerId }, next);
          if (res.ok) {
            setSaved(next);
            setError(null);
          } else setError(res.error);
        });
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full p-2 transition-colors",
        optimistic ? "text-accent" : "text-muted hover:text-fg",
        withLabel && "border border-line-strong px-4 text-sm font-semibold",
        className,
      )}
    >
      <Heart className="h-4 w-4" fill={optimistic ? "currentColor" : "none"} aria-hidden />
      {withLabel && (optimistic ? "Saved" : "Favorite")}
      {error && <span className="sr-only">{error}</span>}
    </button>
  );
}
