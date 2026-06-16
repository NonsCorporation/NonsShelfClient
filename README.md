# nons-library (Nons Shelf)

React client-side app (Next.js App Router) for tracking books and films —
shelves, favorites, ratings, and a shared catalog. Part of the nons family: it
has **no auth of its own** and rides the shared nons SSO session.

## Routing

Real Next.js App Router file-based routes live under `src/app/`:

| Route | Screen |
|---|---|
| `/` | Feed |
| `/library` | Home (shelves) |
| `/discover` | Discover |
| `/calendar` | Calendar |
| `/librarians`, `/librarian/edit/[id]` | Librarian dashboard |
| `/b/[id]`, `/m/[id]`, `/shelf/[id]` | Media detail (book / film / legacy id) |
| `/p/[uuid]` | Person |
| `/u/[id]` | User profile |

Each `page.tsx` renders a screen component from `src/screens/`. Navigation runs
on Next's router via a thin compatibility layer in `src/lib/router.tsx` that
keeps the old `react-router-dom` API (`Link to=`, `useNavigate`, `useParams`,
`useSearchParams`) so the screens didn't need a risky rewrite — inline it if you
want zero abstraction.

Rendering is still **client-only**: `src/app/providers.tsx` holds the provider
tree + the `RequireAuth` SSO gate and renders nothing until mounted, because the
Language/Preferences contexts read `localStorage` during render. Moving public
catalog routes (`/b`, `/m`, `/discover`) to server rendering is the deliberate
next step for SEO — that's the payoff of being on real routes now.

```
npm install
npm run dev          # http://localhost:5173
```

`.env.local` for development (browser-exposed vars use the `NEXT_PUBLIC_` prefix):

```
NEXT_PUBLIC_LIBRARY_API_URL=http://localhost:8081   # nons-library-server (this app's backend)
NEXT_PUBLIC_NONS_API_URL=http://localhost:8080      # nons-server (identity + social)
NEXT_PUBLIC_NONS_LOGIN_URL=http://localhost:3000    # nons login page (for redirects)
```

## Architecture: who talks to whom

```
                      ┌────────────────────┐
   browser (SPA) ───► │ nons-library-server │  library data: media catalog,
        │             │   localhost:8081    │  shelves, favorites, ratings
        │             └─────────┬──────────┘
        │                       │  JWKS fetch (verify tokens)
        │                       │  /api/identity (X-Client-Secret)
        ▼                       ▼
   ┌────────────────────────────────────┐
   │            nons-server             │  identity provider + social platform:
   │           localhost:8080           │  auth, users, friends, posts, chats…
   └────────────────────────────────────┘
```

One session covers everything: nons-server sets an `access_token` cookie on the
parent domain (`.nonsapp.com` in prod; plain `localhost` in dev). Both backends
read that same cookie — nons-server minted it, nons-library-server verifies it
statelessly against nons-server's published public key
(`/.well-known/jwks.json`, EdDSA). Cookies ignore ports, so the dev setup
(5173 / 8080 / 8081 all on localhost) shares the session too.

## Calling the APIs from the SPA

`src/lib/api.ts` exports one helper per backend. Both just attach
`credentials: 'include'` so the session cookie rides along — there is no token
handling in JS (the cookie is HttpOnly).

### Library data → `authedFetch` (nons-library-server)

```ts
import { authedFetch } from '../lib/api'

const res = await authedFetch('/api/media?q=matrix&limit=100')
const { items } = await res.json()
```

### nons social data → `nonsFetch` (nons-server)

This is the answer to "how do I get nons friends / post to nons from the
library": call nons-server **directly from the browser** with `nonsFetch`.
The shared cookie authenticates you; nons-server's CORS already allowlists the
library origins (`localhost:5173` in dev, `LIBRARY_URL` env in prod, default
`https://library.nonsapp.com`).

```ts
import { nonsFetch } from '../lib/api'

// Friends of the signed-in user
const res = await nonsFetch('/api/friendships/friends')
const friends = await res.json()

// Post a review to the nons feed
await nonsFetch('/api/posts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Just finished The Matrix',
    content: 'A 10/10 — believe the hype.',
    post_type: 'text',
    tags: ['movies'],
  }),
})

// Search nons users
await nonsFetch('/api/search/users?q=timur')
```

Useful nons-server endpoint groups (see its Swagger at `/swagger/index.html`):

| Group | Examples |
|---|---|
| `/api/friendships` | `GET /friends`, `POST /request/:username`, `GET /status/:username` |
| `/api/friends`, `/api/follow` | follower/following lists and counts |
| `/api/posts`, `/api/feed` | create/read posts, personal feed |
| `/api/comments` | comments + likes on posts |
| `/api/user`, `/api/profile` | profiles, recommendations |
| `/api/search` | `GET /users?q=` |
| `/api/chats` | DMs (REST + WebSocket/SSE) |
| `/api/auth` | `GET /me`, `POST /refresh`, `POST /logout` |

In-repo example: `src/contexts/AuthContext.tsx` already uses `nonsFetch` for
`/api/auth/refresh` and `/api/auth/logout`.

### Gotchas

- **Cookie-only.** nons-server's user-facing endpoints read the `access_token`
  cookie exclusively — no `Authorization: Bearer` fallback. So they are
  browser-callable, but *not* callable from nons-library-server on a user's
  behalf (see next section for the server-to-server path).
- **Token expiry.** Access tokens live 15 minutes. On a 401, call
  `POST /api/auth/refresh` via `nonsFetch` once and retry —
  `AuthContext` already does this on app load; mirror that pattern for
  long-lived pages.
- **CORS.** New frontends/origins must be added to nons-server's allowlist
  (`FRONTEND_URL` / `LIBRARY_URL` envs in `cmd/server/main.go`); requests
  from unknown origins fail preflight regardless of a valid cookie.

## Backend-to-backend: nons-library-server → nons-server

For data the JWT doesn't carry (e.g. resolving a user id to a profile when
rendering "who else rated this"), nons-library-server calls nons-server's
service API, gated by a shared secret rather than a user session:

```
GET {IDENTITY_BASE_URL}/api/identity/users/:id
X-Client-Secret: {IDENTITY_CLIENT_SECRET}
```

Both sides read `IDENTITY_CLIENT_SECRET` from env and the values must match
(empty = unguarded, dev only). Today only `GET /users/:id` exists; extending
the integration (e.g. "post to the nons feed when a user finishes a book")
means adding endpoints to nons-server's `identityGroup` — keep them behind the
same secret and pass the acting user's id explicitly.

## Adding another nons service later

1. nons-server: add the service name to `JWT_AUDIENCES` (tokens then validate
   at the new backend) and its origin to the CORS allowlist.
2. New backend: verify tokens via JWKS (copy
   nons-library-server's `internal/middleware/auth.go` + `internal/api/service`
   pattern), set `JWT_AUDIENCE` to the name registered above.
3. New frontend: read the shared cookie via `credentials: 'include'` —
   no login UI needed, just redirect to the nons login page with `?redirect=`
   when a request comes back 401.
