import type {
  CodexAppServerNotificationMethod,
  CodexAppServerNotificationParams,
  CodexAppServerServerNotification
} from "../types/appServer.js";
import {
  asRecord,
  numberValue,
  stableFallbackEventId,
  stringValue,
  type RecordValue
} from "./common.js";
import { parseCodexThreadItem, type CodexParsedThreadItem, type CodexParsedTurn } from "./thread-items.js";

type GeneratedEventParams<M extends CodexAppServerNotificationMethod> =
  CodexAppServerNotificationParams<M>;

type TurnNotificationParams<M extends "turn/started" | "turn/completed"> =
  Omit<GeneratedEventParams<M>, "turn"> & {
    turn?: CodexParsedTurn;
    turnId?: string;
  };

type ItemLifecycleParams<M extends "item/started" | "item/completed"> =
  Omit<GeneratedEventParams<M>, "item"> & {
    item: CodexParsedThreadItem;
  };

type ThreadUnarchivedParams = GeneratedEventParams<"thread/unarchived"> & {
  thread?: GeneratedEventParams<"thread/started">["thread"];
};

export type CodexProtocolEventByMethod = {
  [M in CodexAppServerNotificationMethod]:
    M extends "turn/started" | "turn/completed"
      ? TurnNotificationParams<M>
      : M extends "item/started" | "item/completed"
        ? ItemLifecycleParams<M>
        : M extends "thread/unarchived"
          ? ThreadUnarchivedParams
          : GeneratedEventParams<M>;
};

export type CodexUnknownEvent = {
  method: "unknown";
  id: string;
  eventMethod: string;
  params: RecordValue;
  payload: RecordValue;
  readonly __codexUnknownEvent: true;
};

export type CodexUnknownNotification = CodexUnknownEvent;

export type CodexKnownProtocolEvent = {
  [M in keyof CodexProtocolEventByMethod]: {
    method: M;
    params: CodexProtocolEventByMethod[M];
  }
}[keyof CodexProtocolEventByMethod];

export type CodexKnownNotification = CodexKnownProtocolEvent;
export type CodexParsedNotification = CodexKnownProtocolEvent | CodexUnknownEvent;
export type CodexProtocolEvent = CodexParsedNotification;

const knownNotificationMethods = new Set<string>([
  "error",
  "thread/started",
  "thread/status/changed",
  "thread/archived",
  "thread/unarchived",
  "thread/closed",
  "thread/name/updated",
  "thread/goal/updated",
  "thread/goal/cleared",
  "thread/tokenUsage/updated",
  "turn/started",
  "hook/started",
  "turn/completed",
  "hook/completed",
  "turn/diff/updated",
  "turn/plan/updated",
  "item/started",
  "item/autoApprovalReview/started",
  "item/autoApprovalReview/completed",
  "item/completed",
  "item/agentMessage/delta",
  "item/plan/delta",
  "command/exec/outputDelta",
  "process/outputDelta",
  "process/exited",
  "item/commandExecution/outputDelta",
  "item/commandExecution/terminalInteraction",
  "item/fileChange/outputDelta",
  "item/fileChange/patchUpdated",
  "serverRequest/resolved",
  "item/mcpToolCall/progress",
  "mcpServer/oauthLogin/completed",
  "mcpServer/startupStatus/updated",
  "account/updated",
  "account/rateLimits/updated",
  "app/list/updated",
  "remoteControl/status/changed",
  "externalAgentConfig/import/completed",
  "fs/changed",
  "item/reasoning/summaryTextDelta",
  "item/reasoning/summaryPartAdded",
  "item/reasoning/textDelta",
  "thread/compacted",
  "model/rerouted",
  "model/verification",
  "warning",
  "guardianWarning",
  "deprecationNotice",
  "configWarning",
  "fuzzyFileSearch/sessionUpdated",
  "fuzzyFileSearch/sessionCompleted",
  "thread/realtime/started",
  "thread/realtime/itemAdded",
  "thread/realtime/transcript/delta",
  "thread/realtime/transcript/done",
  "thread/realtime/outputAudio/delta",
  "thread/realtime/sdp",
  "thread/realtime/error",
  "thread/realtime/closed",
  "windows/worldWritableWarning",
  "windowsSandbox/setupCompleted",
  "account/login/completed"
] satisfies CodexAppServerServerNotification["method"][]);

export function parseCodexNotification(value: unknown): CodexParsedNotification | undefined {
  const notification = asRecord(value);
  const method = stringValue(notification.method);
  if (!method) {
    return undefined;
  }
  if (!knownNotificationMethods.has(method)) {
    return unknownEventFromValue(notification);
  }
  return {
    method,
    params: normalizeNotificationParams(method, notification.params)
  } as CodexParsedNotification;
}

export function unknownEventFromValue(value: unknown): CodexUnknownEvent {
  const payload = asRecord(value);
  const method = stringValue(payload.method) ?? "unknown";
  return {
    method: "unknown",
    id: stableFallbackEventId({ ...payload, method }),
    eventMethod: method,
    params: asRecord(payload.params),
    payload,
    __codexUnknownEvent: true
  };
}

function normalizeNotificationParams(method: string, value: unknown): RecordValue {
  const params = asRecord(value);
  switch (method) {
    case "thread/tokenUsage/updated":
      return {
        ...params,
        threadId: params.threadId ?? params.thread_id,
        turnId: params.turnId ?? params.turn_id,
        tokenUsage: normalizeThreadTokenUsage(params.tokenUsage ?? params.token_usage)
      };
    case "turn/started":
    case "turn/completed": {
      const turn = normalizeTurn(params.turn);
      return {
        ...params,
        threadId: params.threadId ?? params.thread_id,
        turnId: params.turnId ?? params.turn_id ?? turn?.id,
        turn
      };
    }
    case "item/started":
    case "item/completed": {
      const item = parseCodexThreadItem(params.item);
      return item ? { ...normalizeItemEventParams(params), item } : normalizeItemEventParams(params);
    }
    case "item/agentMessage/delta":
    case "item/plan/delta":
    case "item/commandExecution/outputDelta":
    case "item/fileChange/patchUpdated":
      return normalizeItemEventParams(params);
    case "item/reasoning/summaryPartAdded":
      return {
        ...normalizeItemEventParams(params),
        summaryIndex: numberValue(params.summaryIndex ?? params.summary_index)
      };
    case "item/reasoning/summaryTextDelta":
      return {
        ...normalizeItemEventParams(params),
        summaryIndex: numberValue(params.summaryIndex ?? params.summary_index)
      };
    case "item/reasoning/textDelta":
      return {
        ...normalizeItemEventParams(params),
        contentIndex: numberValue(params.contentIndex ?? params.content_index)
      };
    case "turn/diff/updated":
      return {
        ...params,
        threadId: params.threadId ?? params.thread_id,
        turnId: params.turnId ?? params.turn_id
      };
    default:
      return params;
  }
}

function normalizeItemEventParams(params: RecordValue): RecordValue {
  return {
    ...params,
    threadId: params.threadId ?? params.thread_id,
    turnId: params.turnId ?? params.turn_id,
    itemId: params.itemId ?? params.item_id
  };
}

function normalizeTurn(value: unknown): CodexParsedTurn | undefined {
  const turn = asRecord(value);
  const id = stringValue(turn.id);
  if (!id) {
    return undefined;
  }
  const items = Array.isArray(turn.items)
    ? turn.items.flatMap((item) => {
      const parsed = parseCodexThreadItem(item);
      return parsed ? [parsed] : [];
    })
    : [];
  return {
    ...turn,
    id,
    items
  } as CodexParsedTurn;
}

function normalizeThreadTokenUsage(value: unknown) {
  const usage = asRecord(value);
  return {
    total: normalizeTokenUsageBreakdown(usage.total ?? usage.total_token_usage),
    last: normalizeTokenUsageBreakdown(usage.last ?? usage.last_token_usage),
    modelContextWindow: numberValue(usage.modelContextWindow ?? usage.model_context_window) ?? null
  };
}

function normalizeTokenUsageBreakdown(value: unknown) {
  const usage = asRecord(value);
  return {
    totalTokens: numberValue(usage.totalTokens ?? usage.total_tokens) ?? 0,
    inputTokens: numberValue(usage.inputTokens ?? usage.input_tokens) ?? 0,
    cachedInputTokens: numberValue(usage.cachedInputTokens ?? usage.cached_input_tokens) ?? 0,
    outputTokens: numberValue(usage.outputTokens ?? usage.output_tokens) ?? 0,
    reasoningOutputTokens: numberValue(usage.reasoningOutputTokens ?? usage.reasoning_output_tokens) ?? 0
  };
}
