import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nons :: Shelf",
  icons: { icon: "/shelf.svg" },
};

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
