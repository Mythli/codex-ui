import type { CodexRenderBlock } from "@taylordb/codex";
import type { MarkdownComponents } from "@app/common/pure";
import { TranscriptViewport } from "./TranscriptViewport";

export function CodexChatView({
  blocks,
  nowMs,
  markdownComponents
}: {
  blocks?: readonly CodexRenderBlock[];
  nowMs?: number;
  markdownComponents?: MarkdownComponents;
}) {
  return <TranscriptViewport blocks={blocks ?? []} markdownComponents={markdownComponents} nowMs={nowMs} />;
}
