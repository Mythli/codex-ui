import { z } from "zod";
import {
  CODEX_RESPONSE_ITEM_COMPLETED_METHOD,
  asRecord,
  recordSchema,
  stableFallbackEventId,
  type RecordValue
} from "./common.js";
import {
  codexFileUpdateChangeSchema,
  codexLooseThreadItemSchema,
  codexThreadSchema,
  codexTurnSchema
} from "./thread-items.js";
import { responseItemToThreadItem } from "./response-items.js";

const codexThreadStatusSchema = z.object({
  type: z.string()
}).passthrough();

const codexTokenUsageBreakdownSchema = z.object({
  totalTokens: z.number(),
  inputTokens: z.number(),
  cachedInputTokens: z.number(),
  outputTokens: z.number(),
  reasoningOutputTokens: z.number()
}).passthrough();

const codexFlexibleTokenUsageBreakdownSchema = z.preprocess((value) => {
  const record = asRecord(value);
  return {
    ...record,
    totalTokens: record.totalTokens ?? record.total_tokens,
    inputTokens: record.inputTokens ?? record.input_tokens,
    cachedInputTokens: record.cachedInputTokens ?? record.cached_input_tokens,
    outputTokens: record.outputTokens ?? record.output_tokens,
    reasoningOutputTokens: record.reasoningOutputTokens ?? record.reasoning_output_tokens
  };
}, codexTokenUsageBreakdownSchema);

const codexThreadTokenUsageSchema = z.object({
  total: codexFlexibleTokenUsageBreakdownSchema,
  last: codexFlexibleTokenUsageBreakdownSchema,
  modelContextWindow: z.number().nullable()
}).passthrough();

const codexFlexibleThreadTokenUsageSchema = z.preprocess((value) => {
  const record = asRecord(value);
  return {
    ...record,
    total: record.total ?? record.total_token_usage,
    last: record.last ?? record.last_token_usage,
    modelContextWindow: record.modelContextWindow ?? record.model_context_window ?? null
  };
}, codexThreadTokenUsageSchema);

const codexThreadTokenUsageUpdatedSchema = z.preprocess((value) => {
  const record = asRecord(value);
  return {
    ...record,
    threadId: record.threadId ?? record.thread_id,
    turnId: record.turnId ?? record.turn_id,
    tokenUsage: record.tokenUsage ?? record.token_usage
  };
}, z.object({
  threadId: z.string(),
  turnId: z.string().optional(),
  tokenUsage: codexFlexibleThreadTokenUsageSchema
}).passthrough());

export const codexEventSchemasByMethod = {
  "thread/started": z.object({ thread: codexThreadSchema }).passthrough(),
  "thread/status/changed": z.object({ threadId: z.string(), status: codexThreadStatusSchema }).passthrough(),
  "thread/tokenUsage/updated": codexThreadTokenUsageUpdatedSchema,
  "thread/archived": z.object({ threadId: z.string() }).passthrough(),
  "thread/compacted": z.object({ threadId: z.string(), turnId: z.string() }).passthrough(),
  "model/rerouted": z.object({ threadId: z.string(), turnId: z.string(), fromModel: z.string(), toModel: z.string(), reason: z.unknown() }).passthrough(),
  "model/verification": z.object({ threadId: z.string(), turnId: z.string(), verifications: z.array(z.unknown()) }).passthrough(),
  "turn/started": z.object({ threadId: z.string().optional(), turnId: z.string().optional(), turn: codexTurnSchema.optional() }).passthrough(),
  "turn/completed": z.object({ threadId: z.string().optional(), turnId: z.string().optional(), turn: codexTurnSchema.optional() }).passthrough(),
  "turn/diff/updated": z.object({ threadId: z.string(), turnId: z.string(), diff: z.string() }).passthrough(),
  "item/started": z.object({
    threadId: z.string(),
    turnId: z.string(),
    item: codexLooseThreadItemSchema,
    startedAtMs: z.number().optional()
  }).passthrough(),
  "item/completed": z.object({
    threadId: z.string(),
    turnId: z.string(),
    item: codexLooseThreadItemSchema,
    completedAtMs: z.number().optional()
  }).passthrough(),
  [CODEX_RESPONSE_ITEM_COMPLETED_METHOD]: z.object({
    item: z.unknown().optional()
  }).passthrough().transform((params) => ({
    ...params,
    item: params.item ? responseItemToThreadItem(params.item) : undefined
  })),
  "item/agentMessage/delta": z.object({ threadId: z.string().optional(), turnId: z.string().optional(), itemId: z.string(), delta: z.string() }).passthrough(),
  "item/plan/delta": z.object({ threadId: z.string().optional(), turnId: z.string().optional(), itemId: z.string(), delta: z.string() }).passthrough(),
  "item/reasoning/summaryPartAdded": z.object({ threadId: z.string().optional(), turnId: z.string().optional(), itemId: z.string(), summaryIndex: z.number() }).passthrough(),
  "item/reasoning/summaryTextDelta": z.object({ threadId: z.string().optional(), turnId: z.string().optional(), itemId: z.string(), summaryIndex: z.number(), delta: z.string() }).passthrough(),
  "item/reasoning/textDelta": z.object({ threadId: z.string().optional(), turnId: z.string().optional(), itemId: z.string(), contentIndex: z.number(), delta: z.string() }).passthrough(),
  "item/commandExecution/outputDelta": z.object({ threadId: z.string().optional(), turnId: z.string().optional(), itemId: z.string(), delta: z.string() }).passthrough(),
  "item/fileChange/patchUpdated": z.object({ threadId: z.string().optional(), turnId: z.string().optional(), itemId: z.string(), changes: z.array(codexFileUpdateChangeSchema) }).passthrough(),
  "account/rateLimits/updated": z.object({ rateLimits: recordSchema }).passthrough(),
  "mcpServer/startupStatus/updated": z.object({ name: z.string(), status: z.string(), error: z.unknown().nullable().optional() }).passthrough(),
  "remoteControl/status/changed": z.object({ status: z.string(), installationId: z.string().optional(), environmentId: z.string().nullable().optional() }).passthrough(),
  deprecationNotice: z.object({ summary: z.string(), details: z.string().optional() }).passthrough()
} as const;

export const codexNotificationSchema = z.object({
  method: z.string(),
  params: recordSchema.default({})
}).passthrough();

export const codexItemNotificationSchema = codexNotificationSchema.extend({
  method: z.union([z.literal("item/started"), z.literal("item/completed")]),
  params: z.object({
    threadId: z.string(),
    turnId: z.string(),
    item: codexLooseThreadItemSchema,
    startedAtMs: z.number().optional(),
    completedAtMs: z.number().optional()
  }).passthrough()
});

export const codexTurnNotificationSchema = codexNotificationSchema.extend({
  method: z.union([z.literal("turn/started"), z.literal("turn/completed")]),
  params: z.object({
    threadId: z.string().optional(),
    turnId: z.string().optional(),
    turn: codexTurnSchema.optional()
  }).passthrough()
});

export const codexDeltaNotificationSchema = codexNotificationSchema.extend({
  method: z.union([
    z.literal("item/agentMessage/delta"),
    z.literal("item/plan/delta"),
    z.literal("item/reasoning/summaryPartAdded"),
    z.literal("item/reasoning/summaryTextDelta"),
    z.literal("item/reasoning/textDelta"),
    z.literal("item/commandExecution/outputDelta"),
    z.literal("item/fileChange/patchUpdated")
  ]),
  params: recordSchema
});

export const codexRolloutEntrySchema = z.object({
  type: z.string(),
  payload: z.unknown().optional()
}).passthrough();

export const codexResponseItemSchema = z.object({
  type: z.string()
}).passthrough();

export type CodexUnknownEvent = {
  method: "unknown";
  id: string;
  eventMethod: string;
  params: RecordValue;
  payload: RecordValue;
  readonly __codexUnknownEvent: true;
};

export type CodexUnknownNotification = CodexUnknownEvent;

export type CodexProtocolEventByMethod = {
  [M in keyof typeof codexEventSchemasByMethod]: z.infer<(typeof codexEventSchemasByMethod)[M]>;
};

export type CodexKnownProtocolEvent = {
  [M in keyof CodexProtocolEventByMethod]: {
    method: M;
    params: CodexProtocolEventByMethod[M] & RecordValue;
  }
}[keyof CodexProtocolEventByMethod];

export type CodexKnownNotification = CodexKnownProtocolEvent;
export type CodexParsedNotification = CodexKnownProtocolEvent | CodexUnknownEvent;
export type CodexProtocolEvent = CodexParsedNotification;

export function parseCodexNotification(value: unknown): CodexParsedNotification | undefined {
  const parsed = codexNotificationSchema.safeParse(value);
  if (!parsed.success) {
    return undefined;
  }

  const method = parsed.data.method;
  const schema = codexEventSchemasByMethod[method as keyof typeof codexEventSchemasByMethod];
  if (!schema) {
    return unknownEventFromValue(parsed.data);
  }
  const params = schema.safeParse(parsed.data.params ?? {});
  if (!params.success) {
    return unknownEventFromValue(parsed.data);
  }
  return { method, params: params.data } as CodexParsedNotification;
}

export function unknownEventFromValue(value: unknown): CodexUnknownEvent {
  const payload = asRecord(value);
  const method = typeof payload.method === "string" ? payload.method : "unknown";
  return {
    method: "unknown",
    id: stableFallbackEventId({ ...payload, method }),
    eventMethod: method,
    params: asRecord(payload.params),
    payload,
    __codexUnknownEvent: true
  };
}
