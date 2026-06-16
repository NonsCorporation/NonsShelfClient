import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nons :: Shelf",
  icons: { icon: "/shelf.svg" },
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
