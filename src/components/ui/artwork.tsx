/* eslint-disable @next/next/no-img-element */
import { Music } from "lucide-react";
import { artworkAt, cn } from "@/lib/utils";

export function Artwork({
  src,
  alt,
  size,
  className,
  rounded = "rounded-md",
  priority,
}: {
  src: string | null | undefined;
  alt: string;
  size: number;
  className?: string;
  rounded?: string;
  priority?: boolean;
}) {
  // Request 2x for crisp artwork on high-density screens.
  const url = artworkAt(src, Math.min(1200, Math.max(100, Math.ceil((size * 2) / 100) * 100)));
  if (!url) {
    return (
      <div className={cn("flex aspect-square shrink-0 items-center justify-center bg-surface-3 text-subtle", rounded, className)} style={{ width: size }}>
        <Music className="h-1/3 w-1/3" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      width={size}
      height={size}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={cn("aspect-square shrink-0 bg-surface-3 object-cover", rounded, className)}
    />
  );
}
