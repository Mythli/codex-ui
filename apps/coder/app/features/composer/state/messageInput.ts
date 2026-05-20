import type { CodexParsedUserInput } from "@coder/types";

export type CodexMessageInput = string | CodexParsedUserInput[];

export function parseCodexMessageInput(input: CodexMessageInput): CodexParsedUserInput[] {
  return typeof input === "string"
    ? [{ type: "text", text: input, text_elements: [] }]
    : input;
}
