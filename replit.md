# JUGNU TV

A mobile-first web app for watching live cartoon and kids TV channels.

## Run & Operate

- `pnpm --filter @workspace/anime-cartoon run dev` — run the web app (Vite)
- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Web: React 19 + Vite + Tailwind CSS 4 + hls.js
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild

## Where things live

- `artifacts/anime-cartoon/` — the web app
  - `src/pages/home.tsx` — main channel list and video player
  - `src/components/video-player.tsx` — HLS video player using hls.js
  - `src/index.css` — theme and Tailwind setup
  - `index.html` — app shell and fonts
- `artifacts/api-server/src/routes/streams.ts` — stream proxy, M3U playlist proxy, and channel parser
- `lib/api-spec/openapi.yaml` — API contract for `/healthz`, `/m3u`, `/stream`, `/channels`

## Architecture decisions

- Streams are proxied through the backend (`/api/stream`) to avoid browser CORS restrictions and handle HLS manifests with relative segment URLs.
- The M3U8 manifest is rewritten on the server so every segment URL is also proxied through `/api/stream`.
- The app uses the IPTV-Org public kids category playlist because the original Indian playlist in the uploaded zip redirected to private/ISP-only IPs that are unreachable from the server or a general browser.
- Channel logos are loaded directly from the upstream URLs; the UI shows a fallback TV icon when a logo fails to load.

## Product

Users open the app and see a live TV player at the top and a grid of cartoon/kids channels below. Tapping a channel starts playing it. The app supports search and highlights the currently playing channel.

## User preferences

- No user preferences recorded yet.

## Gotchas

- Some channel logos may not load because the upstream image servers block hotlinking or have CORS restrictions. The UI gracefully falls back to a TV icon.
- Autoplay is blocked by most mobile browsers until the user taps the play button.
- The stream proxy is an open proxy; be cautious if publishing the app publicly.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
- See the `react-vite` skill for frontend conventions.
