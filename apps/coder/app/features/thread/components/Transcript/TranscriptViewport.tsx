import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef
} from "react";
import type { ReactNode } from "react";
import type { CodexRenderBlock } from "@coder/types";
import type { MarkdownComponents } from "@app/common/pure";
import { TranscriptBlockList } from "./TranscriptBlockList";
import { blockSignature } from "./transcriptFormatters";
import styles from "./Transcript.module.css";

const bottomFollowThresholdPx = 4;

export function TranscriptViewport({
  blocks,
  children,
  followBottomSignal,
  markdownComponents,
  nowMs
}: {
  blocks?: readonly CodexRenderBlock[];
  children?: ReactNode;
  followBottomSignal?: number;
  markdownComponents?: MarkdownComponents;
  nowMs?: number;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const signature = useMemo(() => blockSignature(blocks ?? []), [blocks]);
  const scrollToBottom = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    viewport.scrollTo({ top: viewport.scrollHeight });
  }, []);
  const isNearBottom = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return true;
    }
    return viewport.scrollHeight <= viewport.clientHeight ||
      viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= bottomFollowThresholdPx;
  }, []);
  const scrollIfSticky = useCallback(() => {
    if (!shouldStickToBottomRef.current) {
      return;
    }
    scrollToBottom();
    window.requestAnimationFrame(scrollToBottom);
  }, [scrollToBottom]);

  useLayoutEffect(() => {
    shouldStickToBottomRef.current = true;
    scrollToBottom();
    const frame = window.requestAnimationFrame(scrollToBottom);
    return () => window.cancelAnimationFrame(frame);
  }, [followBottomSignal, scrollToBottom]);

  useLayoutEffect(() => {
    scrollIfSticky();
  }, [scrollIfSticky, signature]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const updateStickiness = () => {
      shouldStickToBottomRef.current = isNearBottom();
    };
    const observeChildren = (observer: ResizeObserver) => {
      observer.disconnect();
      observer.observe(viewport);
      for (const child of viewport.children) {
        observer.observe(child);
      }
    };

    const resizeObserver = new ResizeObserver(scrollIfSticky);
    const mutationObserver = new MutationObserver(() => {
      observeChildren(resizeObserver);
      scrollIfSticky();
    });

    viewport.addEventListener("scroll", updateStickiness, { passive: true });
    observeChildren(resizeObserver);
    mutationObserver.observe(viewport, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true
    });

    return () => {
      viewport.removeEventListener("scroll", updateStickiness);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, [isNearBottom, scrollIfSticky]);

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
