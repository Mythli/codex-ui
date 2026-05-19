# @taylordb/git-observer

Typed Git observation and convenience operations for Codex-managed folders.

The package combines two layers:

- `@parcel/watcher` observes filesystem and `.git` updates across platforms.
- `simple-git` reads repository state and performs commits, branches, and pushes through the installed `git` binary.

```ts
import { observeGitFolder } from "@taylordb/git-observer";

const repo = await observeGitFolder("/path/to/workspace");

repo.on("snapshot", ({ snapshot }) => {
  console.log(snapshot.branch.current, snapshot.head);
});

repo.on("commit", ({ snapshot, previous }) => {
  console.log("HEAD changed", previous?.head, snapshot.head);
});

await repo.commitAll("Save Codex changes");
await repo.pushCurrentBranch();

await repo.close();
```

## API Shape

- `observeGitFolder(path, options?)`: opens and starts watching a Git repository.
- `GitObserver.snapshot()`: returns the current `GitSnapshot`.
- `GitObserver.commitAll(message, options?)`: stages and commits selected paths.
- `GitObserver.pushCurrentBranch(options?)`: pushes the current branch, setting upstream when needed.
- `GitObserver.createBranch(name, options?)`: creates or checks out a branch.
- `GitObserver.checkout(ref)`: checks out an existing branch or ref.

Events are `ready`, `snapshot`, `working-tree`, `commit`, `branch`, and `error`.

## Realtime Direction

The app-facing transport will use Socket.IO namespaces so Codex and Git can share one underlying connection while remaining separate libraries.

- `/codex`: Codex RPC and notifications.
- `/git`: Git observer RPC, actions, and notifications.

See [SOCKET_IO_PLAN.md](./SOCKET_IO_PLAN.md) for the planned client/server interface.

Browser client:

```ts
import { GitClient, createGitSocketIoTransport } from "@taylordb/git-observer/browser";

const git = new GitClient({
  transport: createGitSocketIoTransport("/git", { path: "/app-socket" })
});

const repo = await git.repositories.open({ root: "/path/to/workspace" });
await repo.moveToCommit("3f2a91c", { strategy: "new-branch" });
```

Server namespace:

```ts
import { Server } from "socket.io";
import { attachGitObserverNamespace } from "@taylordb/git-observer/server";

const io = new Server(httpServer, { path: "/app-socket" });
attachGitObserverNamespace(io.of("/git"));
```
