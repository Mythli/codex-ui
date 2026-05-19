import type { Namespace, Socket } from "socket.io";
import { GitObserver, type GitPushOptions, type GitSnapshot, observeGitFolder } from "../index.js";
import type {
  CheckoutBranchParams,
  CreateBranchParams,
  CreateCommitParams,
  GitRequestMethod,
  GitSocketIoResponse,
  GitStreamEvent,
  ListCommitsParams,
  MoveToCommitParams,
  MoveToCommitResult,
  OpenRepositoryParams,
  PushCurrentBranchParams
} from "../protocol.js";
import { serializeGitError } from "../protocol.js";

type SocketRequest = {
  method: GitRequestMethod | string;
  params?: unknown;
};

type RequestAck = (response: GitSocketIoResponse) => void;

type RepositorySession = {
  id: string;
  observer: GitObserver;
};

export function attachGitObserverNamespace(namespace: Namespace): GitObserverSocketIoServer {
  const server = new GitObserverSocketIoServer(namespace);
  server.attach();
  return server;
}

export class GitObserverSocketIoServer {
  private repositories = new Map<string, RepositorySession>();

  constructor(private readonly namespace: Namespace) {}

  attach(): void {
    this.namespace.on("connection", (socket) => this.attachSocket(socket));
  }

  async close(): Promise<void> {
    await Promise.all([...this.repositories.values()].map((session) => session.observer.close()));
    this.repositories.clear();
    this.namespace.emit("closed");
  }

  private attachSocket(socket: Socket): void {
    socket.on("request", (request: SocketRequest, ack: RequestAck) => {
      void this.handleRequest(request)
        .then((result) => ack({ ok: true, result }))
        .catch((error: unknown) => ack({ ok: false, error: serializeGitError(error) }));
    });

    socket.on("notify", (request: SocketRequest) => {
      void this.handleRequest(request).catch((error: unknown) => {
        socket.emit("diagnostic", serializeGitError(error).message);
      });
    });
  }

  private async handleRequest(request: SocketRequest): Promise<unknown> {
    switch (request.method) {
      case "repository/open":
        return this.openRepository(request.params as OpenRepositoryParams);
      case "repository/snapshot":
      case "workingTree/status":
        return this.repository(request.params as { repositoryId: string }).observer.snapshot();
      case "branch/create":
        return this.createBranch(request.params as CreateBranchParams);
      case "branch/checkout":
        return this.checkout(request.params as CheckoutBranchParams);
      case "commit/create":
        return this.createCommit(request.params as CreateCommitParams);
      case "history/listCommits":
        return this.listCommits(request.params as ListCommitsParams);
      case "history/moveToCommit":
        return this.moveToCommit(request.params as MoveToCommitParams);
      case "remote/push":
        return this.pushCurrentBranch(request.params as PushCurrentBranchParams);
      default:
        throw new Error(`Unknown Git observer method: ${request.method}`);
    }
  }

  private async openRepository(params: OpenRepositoryParams) {
    const observer = await observeGitFolder(params.root, { watch: params.watch ?? true });
    const repositoryId = observer.root;
    const existing = this.repositories.get(repositoryId);

    if (existing) {
      await observer.close();
      const snapshot = await existing.observer.snapshot();
      return { repositoryId, snapshot };
    }

    const session = { id: repositoryId, observer };
    this.repositories.set(repositoryId, session);
    this.bindObserver(session);

    const snapshot = observer.currentSnapshot() ?? (await observer.snapshot());
    this.broadcast({ method: "git/repository/ready", params: { repositoryId, snapshot } });
    return { repositoryId, snapshot };
  }

  private async createBranch(params: CreateBranchParams): Promise<GitSnapshot> {
    const session = this.repository(params);
    await session.observer.createBranch(params.name, {
      checkout: params.checkout,
      from: params.from
    });
    return session.observer.snapshot();
  }

  private async checkout(params: CheckoutBranchParams): Promise<GitSnapshot> {
    const session = this.repository(params);
    await session.observer.checkout(params.ref);
    return session.observer.snapshot();
  }

  private async createCommit(params: CreateCommitParams): Promise<unknown> {
    const session = this.repository(params);
    return session.observer.commitAll(params.message, params.options);
  }

  private async listCommits(params: ListCommitsParams) {
    const session = this.repository(params);
    const limit = Math.max(1, Math.min(params.limit ?? 30, 100));
    const offset = parseCursorOffset(params.cursor);

    const output = await session.observer.git
      .raw([
        "log",
        "--all",
        "--date=iso-strict",
        `--skip=${offset}`,
        `--max-count=${limit + 1}`,
        "--format=%H%x1f%an%x1f%ae%x1f%ad%x1f%s"
      ])
      .catch((error: unknown) => {
        if (isEmptyHistoryError(error)) {
          return "";
        }
        throw error;
      });
    const rows = output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [hash, authorName, authorEmail, date, ...messageParts] = line.split("\x1f");
        return {
          hash,
          authorName,
          authorEmail,
          date,
          message: messageParts.join("\x1f")
        };
      });
    const commits = rows.slice(0, limit);

    return {
      commits,
      nextCursor: rows.length > limit ? String(offset + limit) : null
    };
  }

  private async moveToCommit(params: MoveToCommitParams): Promise<MoveToCommitResult> {
    const session = this.repository(params);
    const strategy = params.strategy ?? "new-branch";
    const before = await session.observer.snapshot();

    if (!before.clean && !params.discardChanges) {
      throw new Error("Working tree has uncommitted changes. Commit, stash, or explicitly discard changes first.");
    }

    if (params.discardChanges) {
      await session.observer.git.reset(["--hard"]);
    }

    let branch: string | null = null;
    let detached = false;

    if (strategy === "new-branch") {
      const restoreBranch = await this.restoreBranch(session, params.commit, params.branchName);
      branch = restoreBranch.branch;
      if (restoreBranch.exists) {
        await session.observer.git.checkout(branch);
      } else {
        await session.observer.git.checkout(["-b", branch, params.commit]);
      }
    } else if (strategy === "detach") {
      detached = true;
      await session.observer.git.checkout(["--detach", params.commit]);
    } else {
      await session.observer.git.reset(["--hard", params.commit]);
      branch = (await session.observer.snapshot()).branch.current;
    }

    const snapshot = await session.observer.snapshot();
    const result = {
      snapshot,
      checkout: {
        commit: snapshot.head ?? params.commit,
        branch,
        detached,
        strategy
      }
    };

    this.broadcast({
      method: "git/history/moved",
      params: { ...params, strategy, snapshot, checkout: result.checkout }
    });

    return result;
  }

  private async pushCurrentBranch(params: PushCurrentBranchParams): Promise<unknown> {
    const session = this.repository(params);
    const snapshot = await session.observer.snapshot();
    const options: GitPushOptions = params.options ?? {};
    const branch = options.branch ?? snapshot.branch.current;
    const remote = options.remote ?? "origin";

    if (!branch) {
      throw new Error("Cannot push while HEAD is detached");
    }

    this.broadcast({ method: "git/push/started", params: { repositoryId: params.repositoryId, remote, branch } });
    try {
      const result = await session.observer.pushCurrentBranch(options);
      this.broadcast({
        method: "git/push/completed",
        params: { repositoryId: params.repositoryId, remote, branch, result }
      });
      return result;
    } catch (error) {
      this.broadcast({
        method: "git/operation/failed",
        params: { repositoryId: params.repositoryId, operation: "remote/push", error: serializeGitError(error) }
      });
      throw error;
    }
  }

  private repository(params: { repositoryId: string }): RepositorySession {
    const session = this.repositories.get(params.repositoryId);
    if (!session) {
      throw new Error(`Git repository is not open: ${params.repositoryId}`);
    }
    return session;
  }

  private async restoreBranch(
    session: RepositorySession,
    commit: string,
    requestedBranchName?: string
  ): Promise<{ branch: string; exists: boolean }> {
    const baseBranch = requestedBranchName ?? `codex/restore-${commit.slice(0, 12)}`;
    const targetHash = await session.observer.git.revparse([commit]);
    const existingHash = await this.localBranchHash(session, baseBranch);

    if (!existingHash) {
      return { branch: baseBranch, exists: false };
    }
    if (existingHash === targetHash) {
      return { branch: baseBranch, exists: true };
    }

    for (let index = 2; index < 1000; index += 1) {
      const candidate = `${baseBranch}-${index}`;
      if (!(await this.localBranchHash(session, candidate))) {
        return { branch: candidate, exists: false };
      }
    }

    throw new Error(`Unable to find an available restore branch name for ${baseBranch}`);
  }

  private async localBranchHash(session: RepositorySession, branch: string): Promise<string | null> {
    return session.observer.git.revparse(["--verify", `refs/heads/${branch}`]).catch(() => null);
  }

  private bindObserver(session: RepositorySession): void {
    session.observer.on("snapshot", ({ snapshot, previous }) => {
      this.broadcast({
        method: "git/snapshot/updated",
        params: { repositoryId: session.id, snapshot, previous }
      });
    });
    session.observer.on("working-tree", ({ snapshot, previous }) => {
      this.broadcast({
        method: "git/workingTree/changed",
        params: { repositoryId: session.id, snapshot, previous, files: snapshot.files }
      });
    });
    session.observer.on("branch", ({ snapshot, previous }) => {
      this.broadcast({
        method: "git/branch/changed",
        params: { repositoryId: session.id, snapshot, previous, branch: snapshot.branch }
      });
    });
    session.observer.on("commit", ({ snapshot, previous }) => {
      this.broadcast({
        method: "git/commit/created",
        params: { repositoryId: session.id, snapshot, previous, head: snapshot.head }
      });
    });
    session.observer.on("error", ({ error }) => {
      this.broadcast({
        method: "git/operation/failed",
        params: { repositoryId: session.id, operation: "watch", error: serializeGitError(error) }
      });
    });
  }

  private broadcast(event: GitStreamEvent): void {
    this.namespace.emit("event", event);
  }
}

function parseCursorOffset(cursor?: string | null): number {
  if (!cursor) {
    return 0;
  }

  const offset = Number.parseInt(cursor, 10);
  return Number.isFinite(offset) && offset > 0 ? offset : 0;
}

function isEmptyHistoryError(error: unknown): boolean {
  const message = String(error instanceof Error ? error.message : error).toLowerCase();
  return message.includes("does not have any commits yet") || message.includes("bad default revision");
}
