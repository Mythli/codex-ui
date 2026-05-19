import type { CodexRenderBlock, CodexRuntimeState } from "@taylordb/codex";
import type { CoderSelection } from "../types";

export type ChatPaneState =
  | { kind: "home" }
  | { kind: "loading"; chatId: string; title?: string }
  | { kind: "ready"; chatId: string; blocks: readonly CodexRenderBlock[] }
  | { kind: "empty"; chatId: string; title?: string }
  | { kind: "error"; chatId?: string; message: string };

export function deriveActiveTranscript(
  runtimeState: CodexRuntimeState,
  selection: CoderSelection
): CodexRuntimeState | undefined {
  if (selection.kind === "draft") {
    return undefined;
  }
  if (selection.kind === "thread" && runtimeState.threadId === selection.threadId) {
    return runtimeState;
  }
  if (selection.kind === "none" && runtimeState.threadId && runtimeState.renderBlocks.length > 0) {
    return runtimeState;
  }
  return undefined;
}

export function deriveIsRunning(transcript?: CodexRuntimeState): boolean {
  return transcript?.status === "running";
}

export function deriveChatPaneState(input: {
  selection: CoderSelection;
  activeChatTitle?: string;
  error?: string;
  isHydratingSelectedThread?: boolean;
  runtimeState: CodexRuntimeState;
}): ChatPaneState {
  if (input.error) {
    return {
      kind: "error",
      chatId: input.selection.kind === "thread" ? input.selection.threadId : undefined,
      message: input.error
    };
  }
  if (input.selection.kind === "draft") {
    return { kind: "home" };
  }
  if (input.selection.kind === "none" && input.runtimeState.threadId && input.runtimeState.renderBlocks.length > 0) {
    return {
      kind: "ready",
      chatId: input.runtimeState.threadId,
      blocks: input.runtimeState.renderBlocks
    };
  }
  if (input.selection.kind === "none") {
    return { kind: "home" };
  }
  if (input.runtimeState.threadId !== input.selection.threadId) {
    return { kind: "loading", chatId: input.selection.threadId, title: input.activeChatTitle };
  }
  if (input.isHydratingSelectedThread && input.runtimeState.renderBlocks.length === 0) {
    return { kind: "loading", chatId: input.selection.threadId, title: input.activeChatTitle };
  }
  if (input.runtimeState.status === "failed") {
    return {
      kind: "error",
      chatId: input.selection.threadId,
      message: input.runtimeState.error ?? "Failed to load chat."
    };
  }
  if (input.runtimeState.renderBlocks.length > 0) {
    return {
      kind: "ready",
      chatId: input.selection.threadId,
      blocks: input.runtimeState.renderBlocks
    };
  }
  if (input.runtimeState.status === "loading") {
    return { kind: "loading", chatId: input.selection.threadId, title: input.activeChatTitle };
  }
  return { kind: "empty", chatId: input.selection.threadId, title: input.activeChatTitle };
}
