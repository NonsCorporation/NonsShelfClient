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
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# Stage 2: build
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder
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
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Non-root runtime user.
RUN addgroup -S app && adduser -S app -G app

# The traced server bundle, then what it expects next to it: static assets
# (served from .next/static), public/, and assets/fonts (the link-preview
# images read their fonts from disk at runtime).
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
COPY --from=builder --chown=app:app /app/assets ./assets

USER app
EXPOSE 3000

# /robots.txt is prerendered, so this checks the server is up without touching
# the API.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/robots.txt || exit 1

CMD ["node", "server.js"]
