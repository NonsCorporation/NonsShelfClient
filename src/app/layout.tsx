import type { Metadata } from "next";
import "./globals.css";

// Description/keywords paraphrased from the app's own on-page copy
// (librarySubtitle/searchSubtitle in src/lib/locales/en.ts), not invented —
// same convention nons-client follows for its own metadata. The OG/Twitter
// image itself comes from the opengraph-image.tsx / twitter-image.tsx file
// convention (Next wires up the <meta> tags automatically), not listed here.
export const metadata: Metadata = {
  title: "Nons :: Shelf",
  description:
    "Shelf is Nons' library: track the books, films and series you're reading and watching, rate and review them, and see what friends are up to — all in one place.",
  keywords: [
    "Nons Shelf",
    "book tracker",
    "movie tracker",
    "series tracker",
    "reading list",
    "watchlist",
    "book and film library",
    "track books and movies",
  ],
  icons: { icon: "/shelf.svg" },
  openGraph: {
    type: "website",
    url: "https://shelf.nonsapp.com",
    title: "Nons :: Shelf",
    description: "Your books and films, all in one shelf.",
    siteName: "Shelf",
    locale: "en_US",
    images: [
      {
        url: "https://shelf.nonsapp.com/img/og.png",
        width: 1200,
        height: 630,
        alt: "Shelf — Your books and films, all in one shelf.",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@nons",
    creator: "@nons",
    title: "Nons :: Shelf",
    description: "Your books and films, all in one shelf.",
    images: [
      {
        url: "https://shelf.nonsapp.com/img/og.png",
        alt: "Shelf — Your books and films, all in one shelf.",
      },
    ],
  },
  alternates: {
    canonical: "https://shelf.nonsapp.com",
  },
};

// Root layout is intentionally provider-free: the (app) group adds the gated
// client providers, while the (public) group adds SSR-safe, ungated providers.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
