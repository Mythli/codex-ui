import { z } from "zod";
import {
  CODEX_THREAD_START_EXTENDED_EVENTS_FIELD,
  emptyObjectSchema
} from "./common.js";
import { codexUserInputSchema } from "./thread-items.js";

export const codexRequestSchemasByMethod = {
  initialize: z.object({
    clientInfo: z.object({ name: z.string(), version: z.string() }).passthrough(),
    capabilities: z.object({ experimentalApi: z.boolean() }).passthrough()
  }).passthrough(),
  initialized: emptyObjectSchema.default({}),
  "thread/start": z.object({
    cwd: z.string(),
    model: z.string().nullable(),
    modelProvider: z.string().nullable().optional(),
    approvalPolicy: z.unknown(),
    sandbox: z.unknown(),
    ephemeral: z.boolean().optional().default(false),
    [CODEX_THREAD_START_EXTENDED_EVENTS_FIELD]: z.boolean().optional(),
    persistExtendedHistory: z.boolean().optional()
  }).passthrough(),
  "thread/resume": z.object({
    threadId: z.string(),
    cwd: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    modelProvider: z.string().nullable().optional(),
    serviceTier: z.string().nullable().optional(),
    approvalPolicy: z.unknown().nullable().optional(),
    approvalsReviewer: z.unknown().nullable().optional(),
    sandbox: z.unknown().nullable().optional(),
    persistExtendedHistory: z.boolean().optional()
  }).passthrough(),
  "thread/read": z.object({
    threadId: z.string(),
    includeTurns: z.boolean()
  }).passthrough(),
  "thread/list": z.object({
    limit: z.number().optional(),
    sortKey: z.string().optional(),
    sortDirection: z.string().optional(),
    sourceKinds: z.array(z.string()).optional(),
    archived: z.boolean().optional(),
    cwd: z.string().nullable().optional(),
    searchTerm: z.string().optional()
  }).passthrough(),
  "thread/archive": z.object({
    threadId: z.string()
  }).passthrough(),
  "thread/compact/start": z.object({
    threadId: z.string()
  }).passthrough(),
  "turn/start": z.object({
    threadId: z.string(),
    input: z.array(codexUserInputSchema),
    cwd: z.string(),
    approvalPolicy: z.unknown(),
    sandboxPolicy: z.object({ type: z.string() }).passthrough(),
    model: z.string().nullable(),
    effort: z.string().nullable().optional()
  }).passthrough(),
  "turn/interrupt": z.object({
    threadId: z.string().optional(),
    turnId: z.string().optional()
  }).passthrough(),
  "fs/readFile": z.object({
    path: z.string()
  }).passthrough(),
  "model/list": z.object({
    limit: z.number().optional(),
    includeHidden: z.boolean().optional()
  }).passthrough(),
  "config/read": z.object({
    includeLayers: z.boolean(),
    cwd: z.string().nullable().optional()
  }).passthrough()
} as const;

export type CodexRequestParamsByMethod = {
  [M in keyof typeof codexRequestSchemasByMethod]: z.infer<(typeof codexRequestSchemasByMethod)[M]>;
};

export type CodexKnownRequestMethod = keyof CodexRequestParamsByMethod;
export type CodexRequestMethod = CodexKnownRequestMethod | (string & {});
