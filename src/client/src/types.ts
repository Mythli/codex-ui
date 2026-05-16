export type JsonEvent = Record<string, unknown> & {
  type?: string;
  method?: string;
  params?: {
    threadId?: string;
    thread?: {
      id?: string;
    };
    item?: {
      type?: string;
      text?: string;
      command?: string;
      cwd?: string;
      aggregatedOutput?: string | null;
      exitCode?: number | null;
      status?: unknown;
      server?: string;
      tool?: string;
      arguments?: unknown;
      result?: unknown;
      changes?: unknown[];
    };
    delta?: string;
    chunk?: string;
  };
  item?: {
    type?: string;
    text?: string;
  };
  thread_id?: string;
  exitCode?: number | null;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "activity";
  text: string;
  durationMs?: number;
  activities?: ActivityItem[];
  startedAt?: number;
  activityState?: "working" | "done";
};

export type ActivityItem = {
  id: string;
  kind: "command" | "file" | "mcp" | "browser" | "web" | "other";
  title: string;
  detail?: string;
  status?: string;
  output?: string;
  files?: Array<{ path: string; action?: string; additions: number; deletions: number }>;
};

export type CodexMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
};

export type WorkItem =
  | {
      id: string;
      type: "assistantNote";
      text: string;
    }
  | {
      id: string;
      type: "toolSummary";
      activity: ActivityItem;
    };

export type WorkBlockNode = {
  id: string;
  durationMs?: number;
  startedAt?: number;
  state: "working" | "done";
  open: boolean;
  items: WorkItem[];
};

export type CodexTurn = {
  id: string;
  type: "turn";
  userMessage: CodexMessage;
  workBlock?: WorkBlockNode;
  assistantFinal?: CodexMessage;
};

export type StandaloneTranscriptMessage = {
  id: string;
  type: "message";
  message: CodexMessage;
};

export type TranscriptNode = CodexTurn | StandaloneTranscriptMessage;

export type CodexTranscript = TranscriptNode[];

export type ChatSummary = {
  threadId: string;
  title: string;
  cwd?: string;
  source?: string;
  model?: string;
  modelProvider?: string;
  createdAt?: string;
  updatedAt?: string;
  lastAgentMessage?: string;
  messageCount: number;
};

export type ProjectSummary = {
  cwd: string;
  name: string;
  chatCount: number;
  updatedAt?: string;
};

export type ModelSummary = {
  id: string;
  model: string;
  displayName: string;
  defaultReasoningEffort: string;
  supportedReasoningEfforts: string[];
  isDefault: boolean;
};

export type ChatDetail = {
  chat: ChatSummary;
  messages: ChatMessage[];
  raw: JsonEvent;
};
