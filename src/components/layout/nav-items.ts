import { Bell, ChartColumn, Compass, Flame, House, SquarePen, Upload, UserRound } from "lucide-react";

export const NAV = [
  { href: "/", label: "Home", icon: House },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/trending", label: "Trending", icon: Flame },
  { href: "/stats", label: "Listener stats", icon: ChartColumn },
  { href: "/share", label: "Share music", icon: SquarePen },
  { href: "/upload", label: "Upload music", icon: Upload },
  { href: "/activity", label: "Activity", icon: Bell },
] as const;

export const PROFILE_ICON = UserRound;

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
