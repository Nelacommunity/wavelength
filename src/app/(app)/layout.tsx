import { Sidebar } from "@/components/layout/sidebar";
import { MobileHeader, MobileNav } from "@/components/layout/mobile-nav";
import { PlayerBar } from "@/components/player/player-bar";
import { SetupNotice } from "@/components/layout/setup-notice";
import { getCurrentUser } from "@/lib/data/auth";
import { isSupabaseConfigured } from "@/lib/env";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const current = await getCurrentUser();
  const user = current
    ? {
        id: current.profile.id,
        username: current.profile.username,
        display_name: current.profile.display_name,
        avatar_url: current.profile.avatar_url,
        is_demo: current.profile.is_demo,
      }
    : null;

  return (
    <>
      <Sidebar user={user} />
      <MobileHeader user={user} />
      <div className="lg:pl-60">
        <main className="mx-auto w-full max-w-[1400px] px-4 pb-40 pt-5 sm:px-6 lg:px-8 lg:pb-28 lg:pt-8">
          {isSupabaseConfigured ? children : <SetupNotice />}
        </main>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40">
        <PlayerBar />
        <MobileNav user={user} />
      </div>
    </>
  );
}
