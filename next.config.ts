import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'covers.openlibrary.org' },
      { protocol: 'https', hostname: 'books.google.com' },
      { protocol: 'http',  hostname: 'books.google.com' },
      { protocol: 'https', hostname: '*.googleapis.com' },
    ],
  },
};

export default nextConfig;
