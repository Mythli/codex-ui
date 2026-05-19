import { z } from "zod";
import { emptyObjectSchema } from "./common.js";
import {
  codexThreadSchema,
  codexTurnSchema
} from "./thread-items.js";

export const codexThreadReadResponseSchema = z.object({
  thread: codexThreadSchema
}).passthrough();

export const codexThreadListResponseSchema = z.object({
  data: z.array(codexThreadSchema).optional()
}).passthrough();

const rawReasoningEffortSchema = z.union([
  z.string(),
  z.object({ effort: z.string().optional() }).passthrough()
]);

export const codexModelSchema = z.object({
  id: z.string().optional(),
  model: z.string().optional(),
  displayName: z.string().optional(),
  defaultReasoningEffort: z.string().optional(),
  supportedReasoningEfforts: z.array(rawReasoningEffortSchema).optional(),
  isDefault: z.boolean().optional()
}).passthrough();

export const codexModelListResponseSchema = z.object({
  data: z.array(codexModelSchema).optional()
}).passthrough();

export const codexConfigReadResponseSchema = z.object({
  config: z.object({
    model: z.string().nullable().optional(),
    model_reasoning_effort: z.string().nullable().optional(),
    model_provider: z.string().nullable().optional(),
    service_tier: z.string().nullable().optional(),
    model_context_window: z.union([z.number(), z.bigint()]).nullable().optional()
  }).passthrough(),
  origins: z.record(z.string(), z.unknown()).optional(),
  layers: z.array(z.unknown()).nullable().optional()
}).passthrough();

export const codexFsReadFileResponseSchema = z.object({
  dataBase64: z.string().optional(),
  dataText: z.string().optional()
}).passthrough();

export const codexInitializeResponseSchema = z.object({
  userAgent: z.string().optional(),
  codexHome: z.string().optional(),
  platformFamily: z.string().optional(),
  platformOs: z.string().optional()
}).passthrough();

export const codexSessionResponseSchema = z.object({
  thread: codexThreadSchema,
  model: z.string().nullable().optional(),
  modelProvider: z.string().nullable().optional(),
  serviceTier: z.string().nullable().optional(),
  cwd: z.string().optional(),
  instructionSources: z.array(z.string()).optional(),
  approvalPolicy: z.unknown().optional(),
  approvalsReviewer: z.unknown().optional(),
  sandbox: z.unknown().optional(),
  permissionProfile: z.unknown().nullable().optional(),
  activePermissionProfile: z.unknown().nullable().optional(),
  reasoningEffort: z.string().nullable().optional()
}).passthrough();

export const codexTurnStartResponseSchema = z.object({
  turn: codexTurnSchema
}).passthrough();

export const codexResponseSchemasByMethod = {
  initialize: codexInitializeResponseSchema,
  initialized: emptyObjectSchema,
  "thread/start": codexSessionResponseSchema,
  "thread/resume": codexSessionResponseSchema,
  "thread/read": codexThreadReadResponseSchema,
  "thread/list": codexThreadListResponseSchema.extend({
    nextCursor: z.string().nullable().optional(),
    backwardsCursor: z.string().nullable().optional()
  }).passthrough(),
  "thread/archive": emptyObjectSchema,
  "thread/compact/start": emptyObjectSchema,
  "turn/start": codexTurnStartResponseSchema,
  "turn/interrupt": emptyObjectSchema,
  "fs/readFile": codexFsReadFileResponseSchema,
  "model/list": codexModelListResponseSchema,
  "config/read": codexConfigReadResponseSchema
} as const;

export type CodexResponseByMethod = {
  [M in keyof typeof codexResponseSchemasByMethod]: z.infer<(typeof codexResponseSchemasByMethod)[M]>;
};

export type CodexParsedModel = z.infer<typeof codexModelSchema>;
export type CodexParsedConfigReadResponse = z.infer<typeof codexConfigReadResponseSchema>;
export type CodexParsedThreadReadResponse = z.infer<typeof codexThreadReadResponseSchema>;
export type CodexParsedThreadListResponse = z.infer<typeof codexThreadListResponseSchema>;
export type CodexParsedModelListResponse = z.infer<typeof codexModelListResponseSchema>;
export type CodexParsedFsReadFileResponse = z.infer<typeof codexFsReadFileResponseSchema>;
