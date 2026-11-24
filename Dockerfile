# syntax=docker/dockerfile:1

# SomeShelf client (Next.js). Three stages: install, build, and a small runtime
# image that runs the standalone server as a non-root user.
#
#   docker build -t someshelf-client \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://someshelf.com \
#     --build-arg NEXT_PUBLIC_LIBRARY_API_URL= \
#     .
#   docker run -d -p 3000:3000 -e LIBRARY_SERVER_URL=http://server:8081 someshelf-client
#
# NEXT_PUBLIC_* values are baked into the JavaScript at build time, so they are
# build args, not runtime env. LIBRARY_SERVER_URL is read at runtime (the server
# side fetches catalog data from the API for the /b, /m, /p, /list pages).

# ---------------------------------------------------------------------------
# Stage 1: dependencies
# ---------------------------------------------------------------------------
# Debian (glibc), not Alpine (musl): package-lock.json has no musl build of
# lightningcss, so on Alpine the CSS step fails with "Cannot find module
# '../lightningcss.linux-x64-musl.node'".
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Prefer IPv4 when resolving the registry: on hosts with broken IPv6 routing the
# downloads stall and get reset, then fall back much later.
ENV NODE_OPTIONS=--dns-result-order=ipv4first

# The registry connection from a small VPS can drop mid-install (ECONNRESET), so:
# retry each download a few times with a pause, keep fewer sockets open at once,
# skip the audit/funding requests, and keep npm's download cache between builds
# (BuildKit cache mount) so a retried deploy continues from what already arrived
# instead of starting over.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit --no-fund \
      --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 \
      --maxsockets=4

# ---------------------------------------------------------------------------
# Stage 2: build
# ---------------------------------------------------------------------------
FROM node:22-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Public settings, inlined into the client bundle (see .env.example). Empty
# NEXT_PUBLIC_LIBRARY_API_URL = same origin: the reverse proxy in front must send
# /api/* to the library server.
ARG NEXT_PUBLIC_SITE_URL=https://someshelf.com
ARG NEXT_PUBLIC_LIBRARY_API_URL=
ARG NEXT_PUBLIC_PLATFORM_API_URL=
ARG NEXT_PUBLIC_GOOGLE_BOOKS_KEY=
ARG NEXT_PUBLIC_LEGAL_EMAIL=
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_LIBRARY_API_URL=$NEXT_PUBLIC_LIBRARY_API_URL \
    NEXT_PUBLIC_PLATFORM_API_URL=$NEXT_PUBLIC_PLATFORM_API_URL \
    NEXT_PUBLIC_GOOGLE_BOOKS_KEY=$NEXT_PUBLIC_GOOGLE_BOOKS_KEY \
    NEXT_PUBLIC_LEGAL_EMAIL=$NEXT_PUBLIC_LEGAL_EMAIL

RUN npm run build

# ---------------------------------------------------------------------------
# Stage 3: runtime
# ---------------------------------------------------------------------------
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# The traced server bundle, then what it expects next to it: static assets
# (served from .next/static), public/, and assets/fonts (the link-preview
# images read their fonts from disk at runtime).
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/assets ./assets

# The image's built-in non-root user.
USER node
EXPOSE 3000

# /robots.txt is prerendered, so this checks the server is up without touching
# the API.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
