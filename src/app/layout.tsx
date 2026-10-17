import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PlayerProvider } from "@/components/player/player-provider";
import { PwaProvider } from "@/components/pwa/pwa";
import { APP_NAME } from "@/lib/constants";
import { SITE_URL } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${APP_NAME} — share the music you love`, template: `%s · ${APP_NAME}` },
  description: "Discover trending songs, share tracks with friends and see what the world is listening to.",
  openGraph: { siteName: APP_NAME, type: "website" },
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <PwaProvider>
          <PlayerProvider>{children}</PlayerProvider>
        </PwaProvider>
      </body>
    </html>
  );
}
