import type {
  CodexParsedFsReadFileResponse,
  CodexProtocolResponse,
  CodexRequestMethod,
  CodexRequestParams
} from "@taylordb/codex/protocol";
import type { CodexProtocolMiddleware } from "./types.js";
import { fileReadPath } from "./local-file-read-middleware.js";

export type TrafficMeasurementMiddlewareOptions = {
  onDiagnostic?: (text: string) => void;
};

const largeReadBytes = 1_000_000;
const slowReadMs = 500;

export function createTrafficMeasurementMiddleware(
  options: TrafficMeasurementMiddlewareOptions
): CodexProtocolMiddleware {
  return {
    name: "traffic-measurement",
    response(request, response) {
      if (request.method === "fs/readFile") {
        logFsReadSummary(options, "fs/readFile:normalized", request.params, response, 0);
      }
      return response;
    },
    traffic(traffic) {
      if (traffic.kind === "response" && traffic.method === "fs/readFile") {
        logFsReadSummary(options, "fs/readFile:traffic-normalized", {} as CodexRequestParams<CodexRequestMethod>, traffic.response, 0);
      }
      return traffic;
    }
  };
}

export function logFsReadSummary(
  options: TrafficMeasurementMiddlewareOptions,
  event: string,
  params: CodexRequestParams<CodexRequestMethod>,
  response: CodexProtocolResponse<CodexRequestMethod>,
  durationMs: number
): void {
  const path = fileReadPath(params);
  const summary = summarizeFsReadFileResponse(response as CodexParsedFsReadFileResponse);
  if (durationMs < slowReadMs && summary.totalBytes < largeReadBytes) {
    return;
  }
  options.onDiagnostic?.(`[codex backend] ${event} ${JSON.stringify({
    path,
    durationMs,
    ...summary
  })}`);
}

function summarizeFsReadFileResponse(response: CodexParsedFsReadFileResponse) {
  const dataText = typeof response.dataText === "string" ? response.dataText : "";
  const dataBase64 = typeof response.dataBase64 === "string" ? response.dataBase64 : "";
  const decodedBase64Bytes = dataBase64 ? Math.floor(dataBase64.length * 0.75) : 0;
  const textBytes = Buffer.byteLength(dataText, "utf8");
  return {
    totalBytes: textBytes + decodedBase64Bytes,
    dataTextBytes: textBytes,
    dataBase64Chars: dataBase64.length,
    decodedBase64Bytes,
    ...summarizeTextPayload(dataText)
  };
}

function summarizeTextPayload(text: string) {
  if (!text) {
    return {
      lineCount: 0,
      diagnosticRecordCount: 0,
      imageLikeRecordCount: 0,
      assetLikeRecordCount: 0,
      toolRecordCount: 0,
      assistantRecordCount: 0,
      userRecordCount: 0,
      dataUrlCount: 0,
      dataUrlChars: 0,
      base64ImageResultCount: 0,
      base64ImageResultChars: 0,
      largestLineBytes: 0
    };
  }
  const lines = text.split("\n");
  const dataUrls = text.match(/data:image\/[^"'\\\s]+/g) ?? [];
  const imageResults = text.match(/"result"\s*:\s*"([A-Za-z0-9+/=]{1000,})"/g) ?? [];
  const recordCounts = summarizeJsonlRecords(lines);
  return {
    lineCount: lines.length,
    ...recordCounts,
    dataUrlCount: dataUrls.length,
    dataUrlChars: dataUrls.reduce((total, value) => total + value.length, 0),
    base64ImageResultCount: imageResults.length,
    base64ImageResultChars: imageResults.reduce((total, value) => total + value.length, 0),
    largestLineBytes: lines.reduce((largest, line) => Math.max(largest, Buffer.byteLength(line, "utf8")), 0)
  };
}

function summarizeJsonlRecords(lines: string[]) {
  const counts = {
    diagnosticRecordCount: 0,
    imageLikeRecordCount: 0,
    assetLikeRecordCount: 0,
    toolRecordCount: 0,
    assistantRecordCount: 0,
    userRecordCount: 0
  };

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    const record = parseJsonRecord(line);
    const text = line.toLowerCase();
    const payload = record && typeof record.payload === "object" && record.payload
      ? record.payload as Record<string, unknown>
      : undefined;
    const type = typeof record?.type === "string" ? record.type : undefined;
    const payloadType = typeof payload?.type === "string" ? payload.type : undefined;
    const role = typeof payload?.role === "string" ? payload.role : undefined;

    if (type === "diagnostic" || payloadType === "diagnostic" || text.includes("\"diagnostic\"")) {
      counts.diagnosticRecordCount += 1;
    }
    if (text.includes("data:image/") || text.includes("input_image") || text.includes("localimage") || text.includes("imagegeneration")) {
      counts.imageLikeRecordCount += 1;
    }
    if (text.includes("asset://") || text.includes("localimage") || text.includes("local_image")) {
      counts.assetLikeRecordCount += 1;
    }
    if (text.includes("tool") || text.includes("commandexecution") || text.includes("mcp") || text.includes("function_call")) {
      counts.toolRecordCount += 1;
    }
    if (role === "assistant" || payloadType === "agent_message" || payloadType === "agentMessage" || text.includes("\"role\":\"assistant\"")) {
      counts.assistantRecordCount += 1;
    }
    if (role === "user" || payloadType === "user_message" || payloadType === "userMessage" || text.includes("\"role\":\"user\"")) {
      counts.userRecordCount += 1;
    }
  }

  return counts;
}

function parseJsonRecord(line: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(line);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}
