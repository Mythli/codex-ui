import type {
  CheckoutBranchParams,
  CreateBranchParams,
  CreateCommitParams,
  GitRepositoryRef,
  GitStreamEvent,
  GitStreamEventFor,
  GitStreamEventMethod,
  GitStreamEventParams,
  GitTransport,
  ListCommitsParams,
  ListCommitsResult,
  MoveToCommitParams,
  MoveToCommitResult,
  OpenRepositoryParams,
  PushCurrentBranchParams
} from "./protocol.js";
import type { GitCommitOptions, GitPushOptions, GitSnapshot } from "./index.js";

export type GitClientOptions = {
  transport: GitTransport;
};

export class GitClient {
  readonly events: GitEvents;
  readonly repositories: GitRepositoriesResource;

  constructor(readonly options: GitClientOptions) {
    this.events = new GitEvents(options.transport);
    this.repositories = new GitRepositoriesResource(options.transport);
  }

  close(): void {
    this.options.transport.close();
  }
}

export class GitEvents {
  constructor(private readonly transport: GitTransport) {}

  on(listener: (event: GitStreamEvent) => void): () => void {
    return this.transport.onEvent(listener);
  }

  onMethod<M extends GitStreamEventMethod>(
    method: M,
    listener: (params: GitStreamEventParams<M>, event: GitStreamEventFor<M>) => void
  ): () => void {
    return this.on((event) => {
      if (event.method === method) {
        const typedEvent = event as GitStreamEventFor<M>;
        listener(typedEvent.params as GitStreamEventParams<M>, typedEvent);
      }
    });
  }

  onRepository(repositoryId: string, listener: (event: GitStreamEvent) => void): () => void {
    return this.on((event) => {
      if ("repositoryId" in event.params && event.params.repositoryId === repositoryId) {
        listener(event);
      }
    });
  }
}

export class GitRepositoriesResource {
  constructor(private readonly transport: GitTransport) {}

  async open(params: OpenRepositoryParams): Promise<GitRepository> {
    const result = await this.transport.request<{ repositoryId: string; snapshot: GitSnapshot }>(
      "repository/open",
      params
    );
    return new GitRepository(this.transport, result.repositoryId, result.snapshot);
  }

  async snapshot(repositoryId: string): Promise<GitSnapshot> {
    return this.transport.request<GitSnapshot>("repository/snapshot", { repositoryId } satisfies GitRepositoryRef);
  }

  get(repositoryId: string, snapshot?: GitSnapshot): GitRepository {
    return new GitRepository(this.transport, repositoryId, snapshot);
  }
}

export class GitRepository {
  constructor(
    private readonly transport: GitTransport,
    readonly repositoryId: string,
    readonly snapshot?: GitSnapshot
  ) {}

  async read(): Promise<GitSnapshot> {
    return this.transport.request<GitSnapshot>("repository/snapshot", {
      repositoryId: this.repositoryId
    } satisfies GitRepositoryRef);
  }

  async status(): Promise<GitSnapshot> {
    return this.transport.request<GitSnapshot>("workingTree/status", {
      repositoryId: this.repositoryId
    } satisfies GitRepositoryRef);
  }

  async createBranch(name: string, options: Omit<CreateBranchParams, "repositoryId" | "name"> = {}) {
    const snapshot = await this.transport.request<GitSnapshot>("branch/create", {
      repositoryId: this.repositoryId,
      name,
      ...options
    } satisfies CreateBranchParams);
    return new GitRepository(this.transport, this.repositoryId, snapshot);
  }

  async checkout(ref: string) {
    const snapshot = await this.transport.request<GitSnapshot>("branch/checkout", {
      repositoryId: this.repositoryId,
      ref
    } satisfies CheckoutBranchParams);
    return new GitRepository(this.transport, this.repositoryId, snapshot);
  }

  async commitAll(message: string, options?: GitCommitOptions) {
    return this.transport.request("commit/create", {
      repositoryId: this.repositoryId,
      message,
      options
    } satisfies CreateCommitParams);
  }

  async listCommits(options: Omit<ListCommitsParams, "repositoryId"> = {}) {
    return this.transport.request<ListCommitsResult>("history/listCommits", {
      repositoryId: this.repositoryId,
      ...options
    } satisfies ListCommitsParams);
  }

  async moveToCommit(commit: string, options: Omit<MoveToCommitParams, "repositoryId" | "commit"> = {}) {
    return this.transport.request<MoveToCommitResult>("history/moveToCommit", {
      repositoryId: this.repositoryId,
      commit,
      ...options
    } satisfies MoveToCommitParams);
  }

  async pushCurrentBranch(options?: GitPushOptions) {
    return this.transport.request("remote/push", {
      repositoryId: this.repositoryId,
      options
    } satisfies PushCurrentBranchParams);
  }
}
