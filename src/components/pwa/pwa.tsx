"use client";

import { Download, Share, X } from "lucide-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallState = { canInstall: boolean; isIos: boolean; installed: boolean; install: () => Promise<void> };
const InstallContext = createContext<InstallState>({ canInstall: false, isIos: false, installed: false, install: async () => {} });

/** Registers the service worker and exposes the browser's install prompt. */
export function PwaProvider({ children }: { children: ReactNode }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    // Defer state sync out of the effect body.
    queueMicrotask(() => {
      setInstalled(standalone);
      setIsIos(ios);
    });
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const value: InstallState = {
    canInstall: Boolean(deferred),
    isIos,
    installed,
    install: async () => {
      if (!deferred) return;
      await deferred.prompt();
      await deferred.userChoice.catch(() => null);
      setDeferred(null);
    },
  };
  return <InstallContext value={value}>{children}</InstallContext>;
}

export function useInstall() {
  return useContext(InstallContext);
}

/** "Install app" button; on iOS explains Add to Home Screen instead. */
export function InstallButton({ className, compact }: { className?: string; compact?: boolean }) {
  const { canInstall, isIos, installed, install } = useInstall();
  const [showIosHelp, setShowIosHelp] = useState(false);
  if (installed || (!canInstall && !isIos)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => (canInstall ? void install() : setShowIosHelp(true))}
        aria-label="Install Wavelength app"
        className={cn(
          compact
            ? "rounded-full p-2 text-muted hover:text-fg"
            : "flex w-full items-center gap-3.5 rounded-xl px-3 py-2.5 text-[15px] font-medium text-muted transition-colors hover:bg-surface hover:text-fg",
          className,
        )}
      >
        <Download className="h-5 w-5" aria-hidden />
        {!compact && "Install app"}
      </button>
      {showIosHelp && (
        <div role="dialog" aria-label="Install on iPhone" className="fixed inset-x-3 bottom-36 z-[70] rounded-2xl border border-line-strong bg-surface-2 p-4 shadow-2xl">
          <button type="button" onClick={() => setShowIosHelp(false)} aria-label="Close" className="absolute right-2 top-2 rounded-full p-1.5 text-muted hover:text-fg">
            <X className="h-4 w-4" />
          </button>
          <p className="pr-6 font-semibold">Install Wavelength</p>
          <p className="mt-1 text-sm text-muted">
            Tap <Share className="inline h-4 w-4 align-text-bottom" aria-label="Share" /> in Safari, then choose <span className="font-semibold text-fg">Add to Home Screen</span>.
          </p>
        </div>
      )}
    </>
  );
}
