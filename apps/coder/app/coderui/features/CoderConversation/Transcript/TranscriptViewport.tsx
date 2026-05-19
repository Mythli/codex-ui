import { useLayoutEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import type { CodexRenderBlock } from "@taylordb/codex";
import type { MarkdownComponents } from "../../../common";
import { TranscriptBlockList } from "./TranscriptBlockList";
import { blockSignature } from "./transcriptFormatters";
import styles from "./Transcript.module.css";

export function TranscriptViewport({
  blocks,
  children,
  markdownComponents,
  nowMs
}: {
  blocks?: readonly CodexRenderBlock[];
  children?: ReactNode;
  markdownComponents?: MarkdownComponents;
  nowMs?: number;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const signature = useMemo(() => blockSignature(blocks ?? []), [blocks]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const scrollToBottom = () => {
      viewport.scrollTo({ top: viewport.scrollHeight });
    };
    scrollToBottom();
    const frame = window.requestAnimationFrame(scrollToBottom);
    return () => window.cancelAnimationFrame(frame);
  }, [signature]);

  return (
    <div
      aria-label="Chat transcript"
      className={`${styles.messages} coder-scrollbar-thin`}
      data-codex-chat-view
      data-testid="chat-transcript"
      ref={viewportRef}
      role="log"
    >
      {children ?? <TranscriptBlockList blocks={blocks ?? []} markdownComponents={markdownComponents} nowMs={nowMs} />}
    </div>
  );
}
