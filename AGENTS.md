# Agent Notes

## Architecture

- Read `docs/architecture.md` before changing Codex protocol, backend bridge, middleware, Redux traffic, thread reducers, optimistic state, or transcript rendering.
- Keep the Coder API layer thin around Codex. Product interpretation should usually happen in frontend reducers/selectors, while backend middleware should stay focused on bridge concerns such as asset/file access that the browser cannot do directly.

## Work To Be Done

- Before starting planned product work, read the relevant note under `docs/outstanding-work/`:
  - `docs/outstanding-work/api.md`
  - `docs/outstanding-work/common.md`
  - `docs/outstanding-work/composer.md`
  - `docs/outstanding-work/connection.md`
  - `docs/outstanding-work/thread.md`
  - `docs/outstanding-work/threads.md`
  - `docs/outstanding-work/workspace.md`
- Treat `README.md` as the human-facing outstanding-work checklist; the `docs/outstanding-work/` files provide implementation research for those checklist items.
- Read `docs/architecture.md` alongside those notes for architecture-sensitive work so implementation stays aligned with the Codex-centered design.

## Dev Server

- Use the managed dev-server scripts from the repo root:
  - `pnpm dev:start` to start the Coder app.
  - `pnpm dev:status` to check whether it is running.
  - `pnpm dev:logs` or `pnpm dev:tail` to inspect logs.
  - `pnpm dev:stop` only when explicitly asked to stop it.
- The Coder app serves at `http://127.0.0.1:5173/`.
- Do not kill or shut down the dev server casually. If the user asks to bring the app back, prefer `pnpm dev:start`; if it is already running, leave it up.
- The managed server runs in the `codex-api-dev` tmux session and writes logs to `apps/coder/logs/dev-server.log`.

## E2E Tests

- The end-to-end click tests are the source of truth for acceptance. After finishing implementation work, run `pnpm test:e2e:click` from the repo root.
- Do not create broad new unit-test suites or lots of extra tests by default. Prefer validating completed work through the click tests unless the user explicitly asks for another test strategy.
- After running e2e tests, always show the user the generated videos and screenshots from the test artifacts, including direct paths to the relevant files.

## Agent Instruction Files

- Coding agents usually look for `AGENTS.md`.
- A root `AGENTS.md` applies to the whole repo unless a nested `AGENTS.md` exists in a subdirectory with more specific instructions.
