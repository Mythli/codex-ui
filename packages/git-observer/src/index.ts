import { EventEmitter } from "node:events";
import path from "node:path";
import { subscribe, type Event as WatchEvent, type AsyncSubscription } from "@parcel/watcher";
import { simpleGit, type SimpleGit, type StatusResult } from "simple-git";

export { GitClient, GitEvents, GitRepositoriesResource, GitRepository, type GitClientOptions } from "./client.js";
export {
  gitErrorFromWire,
  serializeGitError,
  type CheckoutBranchParams,
  type CreateBranchParams,
  type CreateCommitParams,
  type GitCommit,
  type GitRepositoryRef,
  type GitRequestMethod,
  type GitSocketIoResponse,
  type GitStreamEvent,
  type GitStreamEventFor,
  type GitStreamEventMethod,
  type GitStreamEventParams,
  type GitTransport,
  type GitWireError,
  type ListCommitsParams,
  type ListCommitsResult,
  type MoveToCommitParams,
  type MoveToCommitResult,
  type MoveToCommitStrategy,
  type OpenRepositoryParams,
  type PushCurrentBranchParams
} from "./protocol.js";

export type GitFileStatus =
  | "created"
  | "deleted"
  | "modified"
  | "renamed"
  | "conflicted"
  | "unknown";

export type GitChangedFile = {
  path: string;
  index: string;
  workingTree: string;
  status: GitFileStatus;
};

export type GitBranchSnapshot = {
  current: string | null;
  tracking: string | null;
  ahead: number;
  behind: number;
  local: string[];
  remote: string[];
};

export type GitSnapshot = {
  root: string;
  head: string | null;
  branch: GitBranchSnapshot;
  clean: boolean;
  files: GitChangedFile[];
  updatedAt: string;
};

export type GitObserverOptions = {
  debounceMs?: number;
  watch?: boolean;
  ignored?: string[];
};

export type GitCommitOptions = {
  paths?: string | string[];
  author?: string;
  amend?: boolean;
};

export type GitPushOptions = {
  remote?: string;
  branch?: string;
  setUpstream?: boolean;
  forceWithLease?: boolean;
};

export type GitBranchOptions = {
  checkout?: boolean;
  from?: string;
};

export type GitObserverEventMap = {
  ready: { snapshot: GitSnapshot };
  snapshot: { snapshot: GitSnapshot; previous: GitSnapshot | null; events: WatchEvent[] };
  "working-tree": { snapshot: GitSnapshot; previous: GitSnapshot | null; events: WatchEvent[] };
  commit: { snapshot: GitSnapshot; previous: GitSnapshot | null; events: WatchEvent[] };
  branch: { snapshot: GitSnapshot; previous: GitSnapshot | null; events: WatchEvent[] };
  error: { error: unknown };
};

export type GitObserverEventName = keyof GitObserverEventMap;

export class GitObserver extends EventEmitter {
  readonly root: string;
  readonly git: SimpleGit;

  #options: Required<Pick<GitObserverOptions, "debounceMs" | "watch" | "ignored">>;
  #subscription: AsyncSubscription | null = null;
  #snapshot: GitSnapshot | null = null;
  #pendingEvents: WatchEvent[] = [];
  #refreshTimer: ReturnType<typeof setTimeout> | null = null;
  #closed = false;
  #refreshing: Promise<GitSnapshot> | null = null;

  constructor(root: string, options: GitObserverOptions = {}) {
    super();
    this.root = path.resolve(root);
    this.git = simpleGit({ baseDir: this.root });
    this.#options = {
      debounceMs: options.debounceMs ?? 150,
      watch: options.watch ?? true,
      ignored: options.ignored ?? ["node_modules", "dist", ".next", ".turbo"]
    };
  }

  override on<TEvent extends GitObserverEventName>(
    event: TEvent,
    listener: (payload: GitObserverEventMap[TEvent]) => void
  ): this {
    return super.on(event, listener);
  }

  override once<TEvent extends GitObserverEventName>(
    event: TEvent,
    listener: (payload: GitObserverEventMap[TEvent]) => void
  ): this {
    return super.once(event, listener);
  }

  override emit<TEvent extends GitObserverEventName>(
    event: TEvent,
    payload: GitObserverEventMap[TEvent]
  ): boolean {
    return super.emit(event, payload);
  }

  async open(): Promise<this> {
    await this.ensureRepository();
    const snapshot = await this.refresh([]);
    this.emit("ready", { snapshot });

    if (this.#options.watch) {
      this.#subscription = await subscribe(
        this.root,
        (error, events) => {
          if (error) {
            this.emit("error", { error });
            return;
          }

          this.queueRefresh(events);
        },
        {
          ignore: this.#options.ignored.map((ignoredPath) => path.join(this.root, ignoredPath))
        }
      );
    }

    return this;
  }

  async close(): Promise<void> {
    this.#closed = true;

    if (this.#refreshTimer) {
      clearTimeout(this.#refreshTimer);
      this.#refreshTimer = null;
    }

    if (this.#subscription) {
      await this.#subscription.unsubscribe();
      this.#subscription = null;
    }
  }

  async ensureRepository(): Promise<void> {
    const isRepo = await this.git.checkIsRepo();
    if (!isRepo) {
      throw new Error(`${this.root} is not a Git repository`);
    }
  }

  currentSnapshot(): GitSnapshot | null {
    return this.#snapshot;
  }

  async snapshot(): Promise<GitSnapshot> {
    return this.refresh([]);
  }

  async commitAll(message: string, options: GitCommitOptions = {}) {
    const paths = options.paths ?? ".";
    await this.git.add(paths);

    const commitOptions: Record<string, string | null> = {};

    if (options.author) {
      commitOptions["--author"] = options.author;
    }

    if (options.amend) {
      commitOptions["--amend"] = null;
    }

    const result = await this.git.commit(message, undefined, commitOptions);
    await this.refresh([]);
    return result;
  }

  async pushCurrentBranch(options: GitPushOptions = {}) {
    const snapshot = await this.snapshot();
    const branch = options.branch ?? snapshot.branch.current;

    if (!branch) {
      throw new Error("Cannot push while HEAD is detached");
    }

    const remote = options.remote ?? "origin";
    const args = [
      ...(options.setUpstream ?? !snapshot.branch.tracking ? ["-u"] : []),
      ...(options.forceWithLease ? ["--force-with-lease"] : []),
      remote,
      branch
    ];

    return this.git.push(args);
  }

  async createBranch(name: string, options: GitBranchOptions = {}) {
    const args = [
      ...(options.checkout ?? true ? ["-b"] : []),
      name,
      ...(options.from ? [options.from] : [])
    ];
    const result = await this.git.checkout(args);
    await this.refresh([]);
    return result;
  }

  async checkout(ref: string) {
    const result = await this.git.checkout(ref);
    await this.refresh([]);
    return result;
  }

  private queueRefresh(events: WatchEvent[]): void {
    if (this.#closed) {
      return;
    }

    this.#pendingEvents.push(...events);

    if (this.#refreshTimer) {
      clearTimeout(this.#refreshTimer);
    }

    this.#refreshTimer = setTimeout(() => {
      this.#refreshTimer = null;
      const pendingEvents = this.#pendingEvents.splice(0);
      void this.refresh(pendingEvents).catch((error: unknown) => {
        this.emit("error", { error });
      });
    }, this.#options.debounceMs);
  }

  private async refresh(events: WatchEvent[]): Promise<GitSnapshot> {
    if (this.#refreshing) {
      await this.#refreshing;
    }

    this.#refreshing = this.readSnapshot();

    try {
      const previous = this.#snapshot;
      const snapshot = await this.#refreshing;
      this.#snapshot = snapshot;
      this.emitChanges(snapshot, previous, events);
      return snapshot;
    } finally {
      this.#refreshing = null;
    }
  }

  private async readSnapshot(): Promise<GitSnapshot> {
    const [status, branches, head] = await Promise.all([
      this.git.status(),
      this.git.branch(["-a"]),
      this.git.revparse(["--verify", "HEAD"]).catch(() => null)
    ]);

    return {
      root: this.root,
      head,
      branch: {
        current: status.current || null,
        tracking: status.tracking || null,
        ahead: status.ahead,
        behind: status.behind,
        local: branches.all.filter((branch) => !branch.startsWith("remotes/")),
        remote: branches.all.filter((branch) => branch.startsWith("remotes/"))
      },
      clean: status.isClean(),
      files: mapStatusFiles(status),
      updatedAt: new Date().toISOString()
    };
  }

  private emitChanges(snapshot: GitSnapshot, previous: GitSnapshot | null, events: WatchEvent[]): void {
    this.emit("snapshot", { snapshot, previous, events });

    if (!previous) {
      return;
    }

    if (snapshot.head !== previous.head) {
      this.emit("commit", { snapshot, previous, events });
    }

    if (
      snapshot.branch.current !== previous.branch.current ||
      snapshot.branch.tracking !== previous.branch.tracking ||
      snapshot.branch.local.join("\n") !== previous.branch.local.join("\n") ||
      snapshot.branch.remote.join("\n") !== previous.branch.remote.join("\n")
    ) {
      this.emit("branch", { snapshot, previous, events });
    }

    if (snapshot.clean !== previous.clean || filesKey(snapshot) !== filesKey(previous)) {
      this.emit("working-tree", { snapshot, previous, events });
    }
  }
}

export async function observeGitFolder(root: string, options?: GitObserverOptions): Promise<GitObserver> {
  return new GitObserver(root, options).open();
}

function mapStatusFiles(status: StatusResult): GitChangedFile[] {
  return status.files.map((file) => ({
    path: file.path,
    index: file.index,
    workingTree: file.working_dir,
    status: mapFileStatus(file.index, file.working_dir)
  }));
}

function mapFileStatus(index: string, workingTree: string): GitFileStatus {
  const token = `${index}${workingTree}`;

  if (token.includes("U")) {
    return "conflicted";
  }

  if (token.includes("R")) {
    return "renamed";
  }

  if (token.includes("A") || token.includes("?")) {
    return "created";
  }

  if (token.includes("D")) {
    return "deleted";
  }

  if (token.includes("M")) {
    return "modified";
  }

  return "unknown";
}

function filesKey(snapshot: GitSnapshot): string {
  return snapshot.files.map((file) => `${file.path}:${file.index}:${file.workingTree}`).join("\n");
}
