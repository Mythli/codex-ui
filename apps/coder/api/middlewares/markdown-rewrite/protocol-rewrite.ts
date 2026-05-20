import type {
  CodexParsedFsReadFileResponse,
  CodexParsedThread,
  CodexParsedThreadItem,
  CodexParsedThreadReadResponse,
  CodexParsedTurn,
  CodexProtocolEvent,
  CodexProtocolResponse,
  CodexProtocolTraffic,
  CodexRequestMethod,
  CodexRequestParams
} from "@taylordb/codex/protocol";
import { rewriteMarkdownAssetUrls } from "./rewrite-markdown.js";
import type { MarkdownRewriteContext } from "./types.js";

export function rewriteResponseMarkdown<M extends CodexRequestMethod>(
  method: M,
  params: CodexRequestParams<M>,
  response: CodexProtocolResponse<M>,
  context: MarkdownRewriteContext
): CodexProtocolResponse<M> {
  if (method === "fs/readFile") {
    return rewriteFsReadFileMarkdown(
      response as CodexParsedFsReadFileResponse,
      context,
      (params as CodexRequestParams<"fs/readFile">).path
    ) as CodexProtocolResponse<M>;
  }

  if (method === "thread/read") {
    const readResponse = response as CodexParsedThreadReadResponse;
    return readResponse.thread
      ? { thread: rewriteThreadMarkdown(readResponse.thread, { ...context, cwd: readResponse.thread.cwd ?? context.cwd }) } as CodexProtocolResponse<M>
      : response;
  }

  if (method === "thread/start" || method === "thread/resume") {
    const maybeThreadResponse = response as { thread?: CodexParsedThread };
    return maybeThreadResponse.thread
      ? { ...maybeThreadResponse, thread: rewriteThreadMarkdown(maybeThreadResponse.thread, { ...context, cwd: maybeThreadResponse.thread.cwd ?? context.cwd }) } as CodexProtocolResponse<M>
      : response;
  }

  if (method === "thread/list") {
    const list = response as { data?: CodexParsedThread[] };
    return {
      ...list,
      data: list.data?.map((thread) => rewriteThreadMarkdown(thread, { ...context, cwd: thread.cwd ?? context.cwd }))
    } as CodexProtocolResponse<M>;
  }

  if (method === "turn/start") {
    const turnResponse = response as { turn?: CodexParsedTurn };
    return turnResponse.turn
      ? { ...turnResponse, turn: rewriteTurnMarkdown(turnResponse.turn, context) } as CodexProtocolResponse<M>
      : response;
  }

  return response;
}

export function rewriteEventMarkdown(
  traffic: Extract<CodexProtocolTraffic, { kind: "event" }>,
  context: MarkdownRewriteContext
): CodexProtocolTraffic {
  const event = traffic.event as CodexProtocolEvent;
  if (event.method === "item/started" || event.method === "item/completed") {
    return {
      ...traffic,
      event: {
        ...event,
        params: {
          ...event.params,
          item: rewriteThreadItemMarkdown(event.params.item as CodexParsedThreadItem, context)
        }
      } as CodexProtocolEvent
    };
  }

  if ((event.method === "turn/started" || event.method === "turn/completed") && event.params.turn) {
    return {
      ...traffic,
      event: {
        ...event,
        params: {
          ...event.params,
          turn: rewriteTurnMarkdown(event.params.turn as CodexParsedTurn, context)
        }
      } as CodexProtocolEvent
    };
  }

  if (event.method === "thread/started" && event.params.thread) {
    const thread = event.params.thread as CodexParsedThread;
    return {
      ...traffic,
      event: {
        ...event,
        params: {
          ...event.params,
          thread: rewriteThreadMarkdown(thread, { ...context, cwd: thread.cwd ?? context.cwd })
        }
      } as CodexProtocolEvent
    };
  }

  return traffic;
}

export function rewriteRolloutJsonlMarkdown(
  jsonl: string,
  context: MarkdownRewriteContext
): string {
  return jsonl.split("\n").map((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return line;
    }

    try {
      return JSON.stringify(rewriteRolloutEntryMarkdown(JSON.parse(trimmed), context));
    } catch {
      return line;
    }
  }).join("\n");
}

function rewriteThreadMarkdown(thread: CodexParsedThread, context: MarkdownRewriteContext): CodexParsedThread {
  return {
    ...thread,
    turns: thread.turns.map((turn) => rewriteTurnMarkdown(turn, { ...context, cwd: thread.cwd ?? context.cwd }))
  };
}

function rewriteTurnMarkdown(turn: CodexParsedTurn, context: MarkdownRewriteContext): CodexParsedTurn {
  return {
    ...turn,
    items: turn.items.map((item) => rewriteThreadItemMarkdown(item, context))
  };
}

function rewriteThreadItemMarkdown(
  item: CodexParsedThreadItem,
  context: MarkdownRewriteContext
): CodexParsedThreadItem {
  switch (item.type) {
    case "agentMessage":
    case "plan":
      return {
        ...item,
        text: rewriteMarkdownAssetUrls(item.text, context)
      };
    case "reasoning":
      return {
        ...item,
        summary: item.summary.map((text) => rewriteMarkdownAssetUrls(text, context)),
        content: item.content.map((text) => rewriteMarkdownAssetUrls(text, context))
      };
    default:
      return item;
  }
}

function rewriteFsReadFileMarkdown(
  response: CodexParsedFsReadFileResponse,
  context: MarkdownRewriteContext,
  path?: string
): CodexParsedFsReadFileResponse {
  const dataText = response.dataText ?? decodeBase64(response.dataBase64);
  if (!dataText) {
    return response.dataBase64 ? { ...response, dataBase64: undefined } : response;
  }

  const rewrittenText = path?.endsWith(".jsonl")
    ? rewriteRolloutJsonlMarkdown(dataText, context)
    : dataText;
  return {
    ...response,
    dataBase64: undefined,
    dataText: rewrittenText
  };
}

function rewriteRolloutEntryMarkdown(
  value: unknown,
  context: MarkdownRewriteContext
): unknown {
  if (!isRecord(value)) {
    return value;
  }

  if ((value.type === "event_msg" || value.type === "response_item") && isRecord(value.payload)) {
    return {
      ...value,
      payload: rewriteRolloutPayloadMarkdown(value.payload, context)
    };
  }

  return value;
}

function rewriteRolloutPayloadMarkdown(
  payload: Record<string, unknown>,
  context: MarkdownRewriteContext
): Record<string, unknown> {
  if (payload.type === "agent_message" && typeof payload.message === "string") {
    return { ...payload, message: rewriteMarkdownAssetUrls(payload.message, context) };
  }

  if (payload.type === "user_message" && typeof payload.message === "string") {
    return { ...payload, message: rewriteMarkdownAssetUrls(payload.message, context) };
  }

  if (payload.type === "message" && payload.role === "assistant" && Array.isArray(payload.content)) {
    return {
      ...payload,
      content: payload.content.map((entry) => rewriteTextEntryMarkdown(entry, context))
    };
  }

  if (payload.type === "reasoning") {
    return {
      ...payload,
      summary: rewriteReasoningMarkdownArray(payload.summary, context),
      content: rewriteReasoningMarkdownArray(payload.content, context)
    };
  }

  return payload;
}

function rewriteTextEntryMarkdown(
  value: unknown,
  context: MarkdownRewriteContext
): unknown {
  if (!isRecord(value) || typeof value.text !== "string") {
    return value;
  }
  return {
    ...value,
    text: rewriteMarkdownAssetUrls(value.text, context)
  };
}

function rewriteReasoningMarkdownArray(
  value: unknown,
  context: MarkdownRewriteContext
): unknown {
  if (!Array.isArray(value)) {
    return value;
  }
  return value.map((entry) => {
    if (typeof entry === "string") {
      return rewriteMarkdownAssetUrls(entry, context);
    }
    return rewriteTextEntryMarkdown(entry, context);
  });
}

function decodeBase64(value: string | undefined): string | undefined {
  return value ? Buffer.from(value, "base64").toString("utf8") : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}
