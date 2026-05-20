import type { CodexProtocolEvent } from "./protocol/stream/index.js";
import type {
  CodexAppServerAskForApproval,
  CodexAppServerReasoningEffort,
  CodexAppServerSandboxMode
} from "./protocol/types.js";

export type MessageRequest = {
  message: string;
  cwd?: string;
  model?: string;
  modelProvider?: string;
  reasoningEffort?: CodexAppServerReasoningEffort;
  sandbox?: CodexAppServerSandboxMode;
  approvalPolicy?: CodexAppServerAskForApproval;
  ephemeral?: boolean;
  codexBin?: string;
};

export type CodexRunResult = {
  id: string;
  threadId?: string;
  exitCode: number | null;
  signal: string | null;
  finalMessage?: string;
  events: CodexProtocolEvent[];
  diagnostics: Array<{ stream: "stdout" | "stderr"; text: string }>;
};
