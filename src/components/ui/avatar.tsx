/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

const HUES = [262, 200, 160, 330, 28, 190, 290, 12];

export function Avatar({
  user,
  size = 40,
  className,
}: {
  user: { username: string; display_name?: string | null; avatar_url?: string | null };
  size?: number;
  className?: string;
}) {
  const name = user.display_name || user.username;
  const style = { width: size, height: size };
  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt=""
        width={size}
        height={size}
        style={style}
        className={cn("shrink-0 rounded-full object-cover bg-surface-3", className)}
      />
    );
  }
  const hue = HUES[[...user.username].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length];
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      aria-hidden
      style={{ ...style, background: `hsl(${hue} 45% 26%)`, color: `hsl(${hue} 90% 82%)`, fontSize: size * 0.38 }}
      className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold", className)}
    >
      {initials}
    </span>
  );
}
