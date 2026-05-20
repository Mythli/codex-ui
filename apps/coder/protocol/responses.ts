import type {
  CodexAppServerConfigReadResponse,
  CodexAppServerFsReadFileResponse,
  CodexAppServerInitializeResponse,
  CodexAppServerModel,
  CodexAppServerModelListResponse,
  CodexAppServerThreadListResponse,
  CodexAppServerThreadReadResponse,
  CodexAppServerThreadResumeResponse,
  CodexAppServerThreadStartResponse,
  CodexAppServerTurnStartResponse
} from "../types/appServer.js";
import type { RecordValue } from "./common.js";
import type { CodexParsedThread, CodexParsedTurn } from "./thread-items.js";

export type CodexParsedModel = CodexAppServerModel;
export type CodexParsedConfigReadResponse = CodexAppServerConfigReadResponse;
export type CodexParsedThreadReadResponse = Omit<CodexAppServerThreadReadResponse, "thread"> & {
  thread: CodexParsedThread;
};
export type CodexParsedThreadListResponse = Omit<CodexAppServerThreadListResponse, "data"> & {
  data: CodexParsedThread[];
};
export type CodexParsedModelListResponse = CodexAppServerModelListResponse;
export type CodexParsedFsReadFileResponse = Omit<CodexAppServerFsReadFileResponse, "dataBase64"> & {
  dataBase64?: string;
  dataText?: string;
};
export type CodexParsedThreadStartResponse = Omit<CodexAppServerThreadStartResponse, "thread"> & {
  thread: CodexParsedThread;
};
export type CodexParsedThreadResumeResponse = Omit<CodexAppServerThreadResumeResponse, "thread"> & {
  thread: CodexParsedThread;
};
export type CodexParsedTurnStartResponse = Omit<CodexAppServerTurnStartResponse, "turn"> & {
  turn: CodexParsedTurn;
};

export type CodexResponseByMethod = {
  initialize: CodexAppServerInitializeResponse;
  initialized: RecordValue;
  "thread/start": CodexParsedThreadStartResponse;
  "thread/resume": CodexParsedThreadResumeResponse;
  "thread/read": CodexParsedThreadReadResponse;
  "thread/list": CodexParsedThreadListResponse;
  "thread/archive": RecordValue;
  "thread/compact/start": RecordValue;
  "turn/start": CodexParsedTurnStartResponse;
  "turn/interrupt": RecordValue;
  "fs/readFile": CodexParsedFsReadFileResponse;
  "model/list": CodexAppServerModelListResponse;
  "config/read": CodexAppServerConfigReadResponse;
};
