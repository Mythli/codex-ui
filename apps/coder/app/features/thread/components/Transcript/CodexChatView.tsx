import type { CodexRenderBlock } from "@coder/types";
import type { MarkdownComponents } from "@app/common/pure";
import { TranscriptViewport } from "./TranscriptViewport";

export function CodexChatView({
  blocks,
  followBottomSignal,
  nowMs,
  markdownComponents
}: {
  blocks?: readonly CodexRenderBlock[];
  followBottomSignal?: number;
  nowMs?: number;
  markdownComponents?: MarkdownComponents;
}) {
  return (
    <TranscriptViewport
      blocks={blocks ?? []}
      followBottomSignal={followBottomSignal}
      markdownComponents={markdownComponents}
      nowMs={nowMs}
    />
  );
}
