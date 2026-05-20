# TaylorDB Coder

This repo is a pnpm workspace for a full-stack TanStack Coder app and reusable Codex app-server utilities.

- `apps/coder`: TanStack Start app with the Codex API mounted as server-side app infrastructure.
- `packages/codex`: reusable Codex app-server transport and resource library.
- `bak/`: reference material from the learning UI/TanStack app; not part of active builds.

## Requirements

- Node.js 20 or newer.
- pnpm 10.6.5.
- A working Codex binary on the machine running the app.

The Codex transport uses `CODEX_BIN` when set, otherwise it tries:

```txt
/Applications/Codex.app/Contents/Resources/codex
```

and then falls back to `codex` from `PATH`.

## Quick Start

```sh
pnpm install
pnpm dev:start
```

Open:

```txt
http://127.0.0.1:5173/
```

Health check:

```sh
curl http://127.0.0.1:5173/api/health
```

## Scripts

```sh
pnpm dev
```

Starts `apps/coder` with Vite/TanStack Start.

```sh
pnpm build
```

Builds `@taylordb/codex` and `@taylordb/coder`.

```sh
pnpm typecheck
```

Runs TypeScript checks for workspace packages.

```sh
pnpm test
```

Runs workspace tests where present.

## Workspace Shape

`apps/coder` owns app behavior:

- `app/routes`: TanStack file routes.
- `app/core`: router and Query client setup.
- `app/features`: frontend feature code, feature-local state, hooks, and connected components.
- `app/common`: app-wide pure UI primitives, providers, and shared UI types.
- `app/store`: root Redux store composition and typed hooks.
- `api/core`: Hono API mount backed by `@taylordb/codex`.

`packages/codex` owns reusable Codex logic:

- protocol parsing and typed Codex traffic
- app-server/socket transports
- runtime actions and thread lifecycle
- transcript reduction and render-block projection

The architectural rules for this package live in
[`packages/codex/docs/developer-principles.md`](./packages/codex/docs/developer-principles.md).
Read them before changing Codex protocol, transport, transcript, runtime, or render
contracts.

App-specific Codex behavior, such as `/codex-assets` serving and image/file
normalization, lives in `apps/coder/api/core`.

Coder frontend UI lives inside `apps/coder/app`:

- `app/common/pure`: primitives like Button, Badge, Input, Spinner, EmptyState, Markdown.
- `app/features/*/pure`: prop-driven feature view components and their stories.
- `app/theme.css`: shared UI tokens and base styles.

## API Routes

The app exposes the Codex API under `/api`:

- `GET /api/health`
- `GET /api/models`
- `GET /api/projects`
- `GET /api/chats`
- `GET /api/chats/:threadId`
- `POST /api/chats`
- `POST /api/chats/stream`
- `POST /api/chats/:threadId/messages`
- `POST /api/chats/:threadId/messages/stream`

The streaming routes return newline-delimited JSON.

## Codex Library

Build the Codex package directly:

```sh
pnpm --filter @taylordb/codex build
```

The package exports the reusable pieces used by the app:

- generated Codex app-server protocol aliases via `@taylordb/codex/protocol`
- app-server, replay, and Socket.IO transports
- request planning helpers such as `planStartThread`, `planSendMessage`, and `planOpenThread`
- thread index and transcript reducers
- render-block projection types for the Coder UI
