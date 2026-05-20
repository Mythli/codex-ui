import { memo } from "react";
import type { CodexRenderBlock } from "@taylordb/codex";
import type { MarkdownComponents } from "@app/common/pure";
import { AssistantTurn } from "./AssistantTurn";
import { UserMessageBubble } from "./MessageArticle";
import { TranscriptImageStrip } from "./TranscriptImages";
import styles from "./Transcript.module.css";

export const TranscriptBlockList = memo(function TranscriptBlockList({
  blocks,
  markdownComponents,
  nowMs
}: {
  blocks: readonly CodexRenderBlock[];
  markdownComponents?: MarkdownComponents;
  nowMs?: number;
}) {
  if (blocks.length === 0) {
    return <div className={styles.empty} data-testid="chat-transcript-empty">Start a new chat to see messages here.</div>;
  }

  return (
    <>
      {blocks.map((block) => (
        <TranscriptBlock block={block} key={block.id} markdownComponents={markdownComponents} nowMs={nowMs} />
      ))}
    </>
  );
});

export const TranscriptBlock = memo(function TranscriptBlock({
  block,
  markdownComponents,
  nowMs
}: {
  block: CodexRenderBlock;
  markdownComponents?: MarkdownComponents;
  nowMs?: number;
}) {
  switch (block.type) {
    case "userMessage":
      return <UserMessageBubble attachments={block.attachments} blockId={block.id} cwd={block.cwd} images={block.images} markdownComponents={markdownComponents} text={block.text} />;
    case "assistantTurn":
      return <AssistantTurn block={block} markdownComponents={markdownComponents} nowMs={nowMs} />;
    case "image":
      return <TranscriptImageStrip blockId={block.id} images={block.images} />;
    default:
      return null;
  }
});
