# Agent Notes

## Dev Server

- Use the managed dev-server scripts from the repo root:
  - `pnpm dev:start` to start the Coder app.
  - `pnpm dev:status` to check whether it is running.
  - `pnpm dev:logs` or `pnpm dev:tail` to inspect logs.
  - `pnpm dev:stop` only when explicitly asked to stop it.
- The Coder app serves at `http://127.0.0.1:5173/`.
- Do not kill or shut down the dev server casually. If the user asks to bring the app back, prefer `pnpm dev:start`; if it is already running, leave it up.
- The managed server runs in the `codex-api-dev` tmux session and writes logs to `apps/coder/logs/dev-server.log`.

## Agent Instruction Files

- Coding agents usually look for `AGENTS.md`.
- A root `AGENTS.md` applies to the whole repo unless a nested `AGENTS.md` exists in a subdirectory with more specific instructions.
