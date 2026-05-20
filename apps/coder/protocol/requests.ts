import type {
  CodexAppServerRequestMethod,
  CodexAppServerRequestParams
} from "../types/appServer.js";
import type { RecordValue } from "./common.js";

export type CodexRequestParamsByMethod = {
  [M in CodexAppServerRequestMethod]: CodexAppServerRequestParams<M>;
} & {
  initialized: RecordValue;
  unknown: RecordValue;
};

export type CodexKnownRequestMethod = keyof CodexRequestParamsByMethod;
export type CodexRequestMethod = CodexKnownRequestMethod;
