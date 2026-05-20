# Agent Notes

## Dev Server

- Use `pnpm dev` from the repo root to start the Coder app as a normal foreground Vite process.
- Use `pnpm start` from the repo root to start the built production server after `pnpm build`.
- The Coder app serves at `http://127.0.0.1:5173/`.
- Do not kill or shut down the dev server casually. If it is already running, leave it up.

## Agent Instruction Files

- Coding agents usually look for `AGENTS.md`.
- A root `AGENTS.md` applies to the whole repo unless a nested `AGENTS.md` exists in a subdirectory with more specific instructions.
