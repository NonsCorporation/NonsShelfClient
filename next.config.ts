import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Build-time switch for the Horizon UI (menu items, badge, /horizon). Inlined
  // into the client bundle; anything but 1/true — including unset — means off.
  env: { HORIZON_ON: process.env.HORIZON_ON ?? '0' },
  // /sitemap.xml is the sitemap index, served by the /sitemaps/[name] route like
  // every other sitemap file (see lib/sitemap.ts).
  async rewrites() {
    return [{ source: '/sitemap.xml', destination: '/sitemaps/index.xml' }]
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'covers.openlibrary.org' },
      { protocol: 'https', hostname: 'books.google.com' },
      { protocol: 'http',  hostname: 'books.google.com' },
      { protocol: 'https', hostname: '*.googleapis.com' },
      { protocol: 'https', hostname: '*.nonsapp.com' },
      { protocol: 'http', hostname: '*.nonsapp.com' },
      { protocol: 'https', hostname: '*.someshelf.com' },

      { protocol: 'https', hostname: 'fantlab.ru' },
      { protocol: 'http',  hostname: 'fantlab.ru' },
      { protocol: 'https', hostname: 'image.tmdb.org' },
    ],
  },
};

export default nextConfig;
