import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { AnalyticsHooks } from "@/components/analytics/analytics-hooks";
import { CookieSettingsButton } from "@/components/analytics/consent-banner";
import { SiteHeader } from "@/components/site-header";
import { publicEnv } from "@/lib/env";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv().NEXT_PUBLIC_SITE_URL),
  title: { default: "isMyMediaAI", template: "%s · isMyMediaAI" },
  description: "Community votes and cited evidence on whether movies, TV shows and books used generative AI.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-white text-zinc-900">
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-zinc-200 text-sm text-zinc-600">
          <div className="mx-auto max-w-5xl space-y-2 px-4 py-6">
            <p className="flex gap-4">
              <Link href="/privacy" className="underline">
                Privacy
              </Link>
              <Link href="/corrections" className="underline">
                Corrections
              </Link>
              {publicEnv().NEXT_PUBLIC_POSTHOG_KEY ? <CookieSettingsButton /> : null}
            </p>
            <p>
              Film and TV data from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB. Book
              data from Open Library. Anime and manga data from AniList.
            </p>
          </div>
        </footer>
        <AnalyticsHooks />
      </body>
    </html>
  );
}
