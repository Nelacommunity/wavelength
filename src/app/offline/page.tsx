import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { LogoMark } from "@/components/ui/logo";
import { ReloadButton } from "@/components/pwa/reload-button";

export const metadata: Metadata = { title: "You're offline" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <LogoMark className="h-12 w-12" />
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
        <WifiOff className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <h1 className="text-2xl font-bold">You&apos;re offline</h1>
        <p className="mt-1 max-w-sm text-muted">Wavelength needs a connection to stream music and load the feed. Check your connection and try again.</p>
      </div>
      <ReloadButton />
    </div>
  );
}
