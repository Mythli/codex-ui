import type { CodexParsedUserInput } from "../protocol/stream/index.js";

export type CodexMessageInput = string | CodexParsedUserInput[];

export function parseCodexMessageInput(input: CodexMessageInput): CodexParsedUserInput[] {
  return typeof input === "string"
    ? [{ type: "text", text: input, text_elements: [] }]
    : input;
}
