# Socket.IO Transport Plan

We will use Socket.IO namespaces as the shared realtime layer for Codex and Git.

The goal is one browser connection manager with separate logical namespaces:

```txt
/codex  Codex RPC, notifications, diagnostics
/git    Git observer RPC, actions, notifications, diagnostics
```

Socket.IO handles the namespace multiplexing. The Codex and Git libraries should still stay separate.

## Client Shape

```ts
import { io, Manager } from "socket.io-client";
import { CodexClient } from "@taylordb/codex/browser";
import { GitClient } from "@taylordb/git-observer/browser";

const manager = new Manager("/", {
  path: "/app-socket"
});

const codex = new CodexClient({
  transport: createCodexSocketIoTransport(manager.socket("/codex"))
});

const git = new GitClient({
  transport: createGitSocketIoTransport(manager.socket("/git"))
});
```

Socket.IO can also create sockets directly:

```ts
const codexSocket = io("/codex", { path: "/app-socket" });
const gitSocket = io("/git", { path: "/app-socket" });
```

Using a shared `Manager` makes the single-underlying-connection intent explicit.

## Transport Contract

Each namespace exposes the same small transport shape:

```ts
export interface RealtimeTransport<Event> {
  request<T = unknown>(method: string, params?: unknown): Promise<T>;
  notify(method: string, params?: unknown): void | Promise<void>;
  onEvent(listener: (event: Event) => void): () => void;
  onDiagnostic(listener: (text: string) => void): () => void;
  close(): void;
}
```

Codex keeps its existing `CodexTransport`. Git should expose the equivalent `GitTransport`.

## Socket.IO Events

Use a tiny RPC vocabulary inside each namespace:

```txt
request      client -> server, callback ack returns result
notify       client -> server, fire-and-forget
event        server -> client, typed domain event
diagnostic   server -> client, text diagnostic
closed       server -> client, runtime closed
```

Example request:

```ts
socket.emit(
  "request",
  { method: "history/moveToCommit", params: { repositoryId, commit, strategy: "new-branch" } },
  (response) => {
    if (response.ok) {
      console.log(response.result);
    }
  }
);
```

Ack response:

```ts
type SocketIoResponse =
  | { ok: true; result: unknown }
  | { ok: false; error: { name?: string; message: string; stack?: string } };
```

Domain event:

```ts
socket.emit("event", {
  method: "git/history/moved",
  params: {
    repositoryId,
    commit,
    strategy: "new-branch",
    branchName,
    snapshot
  }
});
```

## Git Event Names

Git should mirror Codex's slash-separated `method` style:

```txt
git/repository/ready
git/snapshot/updated
git/workingTree/changed
git/branch/changed
git/commit/created
git/history/moved
git/push/started
git/push/completed
git/operation/failed
```

## Git Action Names

Actions should also use slash-separated methods:

```txt
repository/open
repository/snapshot
workingTree/status
branch/list
branch/create
branch/checkout
commit/list
commit/create
history/moveToCommit
history/restorePaths
history/resetToCommit
remote/push
```

`history/moveToCommit` should default to the safe strategy:

```ts
type MoveToCommitParams = {
  repositoryId: string;
  commit: string;
  strategy?: "new-branch" | "detach" | "hard-reset";
  branchName?: string;
  discardChanges?: boolean;
};
```

Default:

```ts
{
  strategy: "new-branch",
  discardChanges: false
}
```

## Server Shape

```ts
import { Server } from "socket.io";

const io = new Server(httpServer, {
  path: "/app-socket"
});

attachCodexNamespace(io.of("/codex"), codexRuntime);
attachGitNamespace(io.of("/git"), gitRuntime);
```

Each namespace adapter is responsible for:

- validating methods and params
- calling the domain runtime
- returning request acks
- broadcasting domain events
- serializing errors

The shared Socket.IO server should not know Git or Codex internals.

## Migration Path

1. Keep the existing raw `/codex-ws` bridge while building the Socket.IO path.
2. Add `createCodexSocketIoTransport` beside `createCodexWebSocketTransport`.
3. Add `createGitSocketIoTransport` in `@taylordb/git-observer/browser`.
4. Add app-level Socket.IO Vite plugin mounted at `/app-socket`.
5. Switch the app adapter from `/codex-ws` to `/codex` namespace.
6. Remove the raw bridge once parity is verified.
