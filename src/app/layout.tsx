import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Search results lead with the query people type; link previews lead with the pitch.
const searchTitle = "Profile Card Generator for X, GitHub & Instagram | kado";
const searchDescription =
  "Free profile card generator. Turn an X, GitHub, YouTube, Instagram or LinkedIn profile into a polished image sized for your feed. No sign-up.";
const shareTitle = "kado — your profile, as a card worth posting";
const shareDescription = "Turn an X, LinkedIn, GitHub, YouTube or Instagram handle into a polished share card in seconds.";

// The share images come from opengraph-image.jpg and twitter-image.jpg next to this file.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: searchTitle,
  description: searchDescription,
  alternates: { canonical: "/" },
  openGraph: { title: shareTitle, description: shareDescription, url: "/", siteName: "kado", type: "website", locale: "en_US" },
  twitter: { card: "summary_large_image", title: shareTitle, description: shareDescription, creator: "@ArmanKiyotaka" },
};

export const viewport: Viewport = {
  themeColor: "#fafaf7",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
