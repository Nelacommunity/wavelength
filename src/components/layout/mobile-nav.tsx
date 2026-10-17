"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Compass, Flame, House, Plus, Search, UserRound } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/avatar";
import { isActive } from "@/components/layout/nav-items";
import { InstallButton } from "@/components/pwa/pwa";
import type { ProfileSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MobileHeader({ user }: { user: ProfileSummary | null }) {
  return (
    <header className="sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur lg:hidden">
      <Logo />
      <div className="flex items-center gap-1">
        <InstallButton compact />
        <Link href="/discover" aria-label="Search" className="rounded-full p-2 text-muted hover:text-fg">
          <Search className="h-5 w-5" />
        </Link>
        {user ? (
          <>
            <Link href="/activity" aria-label="Activity" className="rounded-full p-2 text-muted hover:text-fg">
              <Bell className="h-5 w-5" />
            </Link>
            <Link href={`/u/${user.username}`} aria-label="Your profile" className="ml-1">
              <Avatar user={user} size={30} />
            </Link>
          </>
        ) : (
          <Link href="/login" className="ml-1 rounded-full bg-fg px-3.5 py-1.5 text-sm font-semibold text-black">
            Log in
          </Link>
        )}
      </div>
    </header>
  );
}

export function MobileNav({ user }: { user: ProfileSummary | null }) {
  const pathname = usePathname();
  const items = [
    { href: "/", label: "Home", icon: House },
    { href: "/discover", label: "Discover", icon: Compass },
    { href: "/share", label: "Share", icon: Plus, primary: true },
    { href: "/trending", label: "Trending", icon: Flame },
    { href: user ? `/u/${user.username}` : "/login", label: "Profile", icon: UserRound },
  ];
  return (
    <nav aria-label="Main" className="grid h-[calc(4rem+env(safe-area-inset-bottom))] grid-cols-5 border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] lg:hidden">
      {items.map(({ href, label, icon: Icon, primary }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn("flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active ? "text-fg" : "text-subtle")}
          >
            {primary ? (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-black">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
            ) : (
              <Icon className={cn("h-5 w-5", active && "text-accent")} aria-hidden />
            )}
            {!primary && label}
            {primary && <span className="sr-only">{label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
