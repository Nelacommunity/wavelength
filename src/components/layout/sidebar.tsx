"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { NAV, PROFILE_ICON, isActive } from "@/components/layout/nav-items";
import { signOut } from "@/lib/actions/auth";
import { InstallButton } from "@/components/pwa/pwa";
import type { ProfileSummary } from "@/lib/types";
import { cn, displayName } from "@/lib/utils";

export function Sidebar({ user }: { user: ProfileSummary | null }) {
  const pathname = usePathname();
  const profileHref = user ? `/u/${user.username}` : "/login";
  const items = [...NAV, { href: profileHref, label: "Profile", icon: PROFILE_ICON }];

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-bg pb-[80px] lg:flex">
      <div className="px-5 pb-6 pt-6">
        <Logo />
      </div>
      <nav aria-label="Main" className="flex-1 space-y-0.5 px-3">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href) || (label === "Profile" && pathname.startsWith("/settings"));
          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3.5 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors",
                active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface hover:text-fg",
              )}
            >
              <Icon className={cn("h-5 w-5", active && "text-accent")} aria-hidden />
              {label}
            </Link>
          );
        })}
        <InstallButton />
      </nav>

      <div className="border-t border-line p-3">
        {user ? (
          <div className="flex items-center gap-3 rounded-xl p-2">
            <Link href={`/u/${user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar user={user} size={36} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{displayName(user)}</div>
                <div className="truncate text-xs text-muted">@{user.username}</div>
              </div>
            </Link>
            <form action={signOut}>
              <button type="submit" aria-label="Log out" title="Log out" className="rounded-full p-2 text-muted hover:bg-surface-2 hover:text-fg">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-2 p-2">
            <p className="text-sm text-muted">Share what you&apos;re listening to and see what&apos;s trending.</p>
            <ButtonLink href="/signup" className="w-full">Sign up free</ButtonLink>
            <ButtonLink href="/login" variant="ghost" className="w-full">Log in</ButtonLink>
          </div>
        )}
      </div>
    </aside>
  );
}
