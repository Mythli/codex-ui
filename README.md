# TaylorDB Coder

This repo is a pnpm workspace for a full-stack TanStack Coder app and a reusable Coder UI package.

- `apps/coder`: TanStack Start app with the Codex API mounted as server-side app infrastructure.
- `packages/codex`: reusable Codex app-server transport and resource library.
- `packages/coderui`: presentational React UI library for the Coder shell.
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
pnpm dev --port 41731
```

Open:

```txt
http://localhost:41731/
```

Health check:

```sh
curl http://localhost:41731/api/health
```

## Scripts

```sh
pnpm dev
```

Starts `apps/coder` with Vite/TanStack Start.

```sh
pnpm build
```

Builds `@taylordb/coderui` with tsup and `@taylordb/coder` with TanStack Start.

```sh
pnpm typecheck
```

Runs TypeScript checks for the app and UI package.

```sh
pnpm test
```

Runs workspace tests where present.

## Workspace Shape

`apps/coder` owns app behavior:

- `app/routes`: TanStack file routes.
- `app/core`: router and Query client setup.
- `app/features/Coder`: connected app feature code, adapters, hooks, and types.
- `api/core`: Hono API mount.
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

`packages/coderui` owns reusable UI:

- `src/common`: primitives like Button, Badge, Input, Spinner, EmptyState, Markdown.
- `src/features/Coder/pure`: prop-driven Coder shell primitives.
- `src/theme.css`: shared UI tokens and base styles.
- `src/index.ts`: public package entry.

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

## UI Package

Build the UI package directly:

```sh
pnpm --filter @taylordb/coderui build
```

Dry-run the package contents:

```sh
cd packages/coderui
npm pack --dry-run
```

The package exports:

- `@taylordb/coderui`
- `@taylordb/coderui/style.css`

## Codex Library

Build the Codex package directly:

```sh
pnpm --filter @taylordb/codex build
```

The package exports the same high-level helpers used by the app API:

- `runCodex`
- `streamCodex`
- `listCodexChats`
- `listCodexProjects`
- `listCodexModels`
- `readCodexChat`
- `messageRequestSchema`
