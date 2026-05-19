import type { GitBranchSnapshot, GitChangedFile, GitCommitOptions, GitPushOptions, GitSnapshot } from "./index.js";

export type GitWireError = {
  name?: string;
  message: string;
  stack?: string;
};

export type GitRepositoryRef = {
  repositoryId: string;
};

export type MoveToCommitStrategy = "new-branch" | "detach" | "hard-reset";

export type MoveToCommitParams = GitRepositoryRef & {
  commit: string;
  strategy?: MoveToCommitStrategy;
  branchName?: string;
  discardChanges?: boolean;
};

export type MoveToCommitResult = {
  snapshot: GitSnapshot;
  checkout: {
    commit: string;
    branch: string | null;
    detached: boolean;
    strategy: MoveToCommitStrategy;
  };
};

export type GitCommit = {
  hash: string;
  message: string;
  authorName?: string;
  authorEmail?: string;
  date?: string;
};

export type ListCommitsParams = GitRepositoryRef & {
  cursor?: string | null;
  limit?: number;
};

export type ListCommitsResult = {
  commits: GitCommit[];
  nextCursor: string | null;
};

export type GitStreamEvent =
  | { method: "git/repository/ready"; params: { repositoryId: string; snapshot: GitSnapshot } }
  | {
      method: "git/snapshot/updated";
      params: { repositoryId: string; snapshot: GitSnapshot; previous: GitSnapshot | null };
    }
  | {
      method: "git/workingTree/changed";
      params: {
        repositoryId: string;
        snapshot: GitSnapshot;
        previous: GitSnapshot | null;
        files: GitChangedFile[];
      };
    }
  | {
      method: "git/branch/changed";
      params: {
        repositoryId: string;
        snapshot: GitSnapshot;
        previous: GitSnapshot | null;
        branch: GitBranchSnapshot;
      };
    }
  | {
      method: "git/commit/created";
      params: { repositoryId: string; snapshot: GitSnapshot; previous: GitSnapshot | null; head: string | null };
    }
  | {
      method: "git/history/moved";
      params: MoveToCommitParams & { snapshot: GitSnapshot; checkout: MoveToCommitResult["checkout"] };
    }
  | { method: "git/push/started"; params: GitRepositoryRef & { remote: string; branch: string } }
  | { method: "git/push/completed"; params: GitRepositoryRef & { remote: string; branch: string; result: unknown } }
  | { method: "git/operation/failed"; params: GitRepositoryRef & { operation: string; error: GitWireError } };

export type GitStreamEventMethod = GitStreamEvent["method"];
export type GitStreamEventFor<M extends GitStreamEventMethod> = Extract<GitStreamEvent, { method: M }>;
export type GitStreamEventParams<M extends GitStreamEventMethod> = GitStreamEventFor<M>["params"];

export type GitRequestMethod =
  | "repository/open"
  | "repository/snapshot"
  | "workingTree/status"
  | "branch/create"
  | "branch/checkout"
  | "commit/create"
  | "history/listCommits"
  | "history/moveToCommit"
  | "remote/push";

export type OpenRepositoryParams = {
  root: string;
  watch?: boolean;
};

export type CreateBranchParams = GitRepositoryRef & {
  name: string;
  checkout?: boolean;
  from?: string;
};

export type CheckoutBranchParams = GitRepositoryRef & {
  ref: string;
};

export type CreateCommitParams = GitRepositoryRef & {
  message: string;
  options?: GitCommitOptions;
};

export type PushCurrentBranchParams = GitRepositoryRef & {
  options?: GitPushOptions;
};

export interface GitTransport {
  request<T = unknown>(method: GitRequestMethod | string, params?: unknown): Promise<T>;
  notify(method: string, params?: unknown): void | Promise<void>;
  onEvent(listener: (event: GitStreamEvent) => void): () => void;
  onDiagnostic(listener: (text: string) => void): () => void;
  close(): void;
}

export type GitSocketIoResponse =
  | { ok: true; result: unknown }
  | { ok: false; error: GitWireError };

export function serializeGitError(error: unknown): GitWireError {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

export function gitErrorFromWire(error: unknown): Error {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    const nextError = new Error(error.message);
    if ("name" in error && typeof error.name === "string") {
      nextError.name = error.name;
    }
    if ("stack" in error && typeof error.stack === "string") {
      nextError.stack = error.stack;
    }
    return nextError;
  }
  return new Error(String(error));
}
