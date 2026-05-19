import { z } from "zod";
import type { CodexProtocolEvent } from "./protocol/stream/index.js";

export const codexOptionsSchema = z.object({
  cwd: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  modelProvider: z.string().min(1).optional(),
  reasoningEffort: z.enum(["none", "minimal", "low", "medium", "high", "xhigh"]).default("medium"),
  sandbox: z.enum(["read-only", "workspace-write", "danger-full-access"]).default("read-only"),
  approvalPolicy: z.enum(["untrusted", "on-request", "never"]).default("never"),
  ephemeral: z.boolean().default(false),
  codexBin: z.string().min(1).optional()
});

export const messageRequestSchema = codexOptionsSchema.extend({
  message: z.string().min(1)
});

export type MessageRequest = z.infer<typeof messageRequestSchema>;

export type CodexRunResult = {
  id: string;
  threadId?: string;
  exitCode: number | null;
  signal: string | null;
  finalMessage?: string;
  events: CodexProtocolEvent[];
  diagnostics: Array<{ stream: "stdout" | "stderr"; text: string }>;
};
