export type RecordValue = Record<string, unknown>;

export const CODEX_RESPONSE_ITEM_COMPLETED_METHOD = "rawResponseItem/completed";
export const CODEX_THREAD_START_EXTENDED_EVENTS_FIELD = "experimentalRawEvents";

export function stableFallbackId(item: { type: string } & RecordValue): string {
  return `unknown-${item.type}-${hashString(stableStringify(item))}`;
}

export function stableFallbackEventId(event: { method: string } & RecordValue): string {
  return `unknown-${event.method}-${hashString(stableStringify(event))}`;
}

export function stableTrafficId(kind: string, method: string, value: unknown): string {
  return `${kind}-${method}-${hashString(stableStringify(value))}`;
}

export function asRecord(value: unknown): RecordValue {
  return isRecord(value) ? value : { value };
}

export function asOptionalRecord(value: unknown): RecordValue | undefined {
  return isRecord(value) ? value : undefined;
}

export function stableStringify(value: unknown): string {
  if (!isRecord(value) && !Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

export function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

export function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null;
}

export function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function requestIdValue(value: unknown): string | undefined {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return undefined;
}
