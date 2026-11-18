import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
          <div className="mx-auto max-w-5xl px-4 py-6">
            <p>
              Film and TV data from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB. Book
              data from Open Library.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
