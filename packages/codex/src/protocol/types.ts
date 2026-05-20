import type {
  ClientRequest,
  InitializeParams,
  InitializeResponse,
  ReasoningEffort,
  RequestId,
  ServerNotification,
  ServerRequest
} from "./generated/app-server/index.js";
import type {
  AskForApproval,
  Config,
  ConfigReadParams,
  ConfigReadResponse,
  FsReadDirectoryResponse,
  FsReadFileParams,
  FsReadFileResponse,
  Model,
  ModelListParams,
  ModelListResponse,
  SandboxMode,
  SandboxPolicy,
  Thread,
  ThreadArchiveParams,
  ThreadCompactStartParams,
  ThreadItem,
  ThreadListParams,
  ThreadListResponse,
  ThreadReadParams,
  ThreadReadResponse,
  ThreadResumeParams,
  ThreadResumeResponse,
  ThreadStartParams,
  ThreadStartResponse,
  Turn,
  TurnInterruptParams,
  TurnStartParams,
  TurnStartResponse,
  UserInput
} from "./generated/app-server/v2/index.js";

export type CodexAppServerClientRequest = ClientRequest;
export type CodexAppServerRequestId = RequestId;
export type CodexAppServerRequestMethod = ClientRequest["method"];
export type CodexAppServerRequestParams<M extends CodexAppServerRequestMethod> = Extract<
  ClientRequest,
  { method: M }
>["params"];

export type CodexAppServerServerNotification = ServerNotification;
export type CodexAppServerNotificationMethod = ServerNotification["method"];
export type CodexAppServerNotificationParams<M extends CodexAppServerNotificationMethod> = Extract<
  ServerNotification,
  { method: M }
>["params"];

export type CodexAppServerServerRequest = ServerRequest;
export type CodexAppServerInitializeParams = InitializeParams;
export type CodexAppServerInitializeResponse = InitializeResponse;

export type CodexAppServerThread = Thread;
export type CodexAppServerTurn = Turn;
export type CodexAppServerThreadItem = ThreadItem;
export type CodexAppServerUserInput = UserInput;

export type CodexAppServerThreadStartParams = ThreadStartParams;
export type CodexAppServerThreadStartResponse = ThreadStartResponse;
export type CodexAppServerThreadResumeParams = ThreadResumeParams;
export type CodexAppServerThreadResumeResponse = ThreadResumeResponse;
export type CodexAppServerThreadReadParams = ThreadReadParams;
export type CodexAppServerThreadReadResponse = ThreadReadResponse;
export type CodexAppServerThreadListParams = ThreadListParams;
export type CodexAppServerThreadListResponse = ThreadListResponse;
export type CodexAppServerThreadArchiveParams = ThreadArchiveParams;
export type CodexAppServerThreadCompactStartParams = ThreadCompactStartParams;

export type CodexAppServerTurnStartParams = TurnStartParams;
export type CodexAppServerTurnStartResponse = TurnStartResponse;
export type CodexAppServerTurnInterruptParams = TurnInterruptParams;

export type CodexAppServerModel = Model;
export type CodexAppServerModelListParams = ModelListParams;
export type CodexAppServerModelListResponse = ModelListResponse;

export type CodexAppServerConfig = Config;
export type CodexAppServerConfigReadParams = ConfigReadParams;
export type CodexAppServerConfigReadResponse = ConfigReadResponse;

export type CodexAppServerFsReadFileParams = FsReadFileParams;
export type CodexAppServerFsReadFileResponse = FsReadFileResponse;
export type CodexAppServerFsReadDirectoryResponse = FsReadDirectoryResponse;

export type CodexAppServerReasoningEffort = ReasoningEffort;
export type CodexAppServerAskForApproval = AskForApproval;
export type CodexAppServerSandboxMode = SandboxMode;
export type CodexAppServerSandboxPolicy = SandboxPolicy;
