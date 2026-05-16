# codex-api

A small TypeScript + Hono HTTP wrapper around the Codex CLI JSONL mode, with a Hono-served React UI for creating chats, sending messages, and inspecting raw JSON events.

## Setup

```sh
npm install
npm run dev
```

The server listens on `http://localhost:3000` by default. Override with `PORT=4000 npm run dev`.

Open the UI at `http://localhost:3000`. The route summary is available at `GET /api`.

## Scripts

- `npm run dev` builds the React client once, then starts the Hono server in watch mode.
- `npm run build` builds the TypeScript server and React client.
- `npm run typecheck` checks both server and client TypeScript.

## Routes

- `GET /health`
- `GET /api`
- `POST /chats`
- `POST /chats/stream`
- `POST /chats/:threadId/messages`
- `POST /chats/:threadId/messages/stream`

The non-streaming routes collect Codex JSON events and return:

```json
{
  "id": "api-run-id",
  "threadId": "codex-thread-id",
  "exitCode": 0,
  "signal": null,
  "finalMessage": "assistant text",
  "events": [],
  "diagnostics": []
}
```

The streaming routes return newline-delimited JSON. Codex CLI events are forwarded as they arrive, with wrapper events for process lifecycle and diagnostics:

```jsonl
{"type":"process.started","runId":"...","args":["exec","--json", "..."]}
{"type":"thread.started","thread_id":"..."}
{"type":"turn.started"}
{"type":"item.completed","item":{"type":"agent_message","text":"pong"}}
{"type":"turn.completed","usage":{"input_tokens":1,"output_tokens":1}}
{"type":"process.completed","exitCode":0,"signal":null}
```

## Create a Chat

```sh
curl -s http://localhost:3000/chats \
  -H 'content-type: application/json' \
  -d '{"message":"Reply with exactly: pong"}'
```

## Stream a New Chat

```sh
curl -N http://localhost:3000/chats/stream \
  -H 'content-type: application/json' \
  -d '{"message":"Reply with exactly: pong"}'
```

## Send a Message to an Existing Chat

Use the `threadId` returned by `POST /chats`.

```sh
curl -s http://localhost:3000/chats/THREAD_ID/messages \
  -H 'content-type: application/json' \
  -d '{"message":"Continue with one short sentence"}'
```

## Request Options

Every message body accepts:

```json
{
  "message": "Required prompt text",
  "cwd": "/path/to/workspace",
  "model": "optional-model",
  "sandbox": "read-only",
  "approvalPolicy": "never",
  "skipGitRepoCheck": true,
  "ephemeral": false,
  "ignoreUserConfig": false,
  "ignoreRules": false,
  "bypassApprovalsAndSandbox": false,
  "codexBin": "/Applications/Codex.app/Contents/Resources/codex"
}
```

By default the wrapper runs Codex with `--sandbox read-only`, `--ask-for-approval never`, and `--skip-git-repo-check`.
