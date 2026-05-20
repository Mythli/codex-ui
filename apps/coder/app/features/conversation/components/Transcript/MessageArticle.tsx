import { useMemo } from "react";
import type { ReactNode } from "react";
import type { CodexTranscriptAttachment, CodexTranscriptImage } from "@taylordb/codex";
import { Markdown, type MarkdownComponents } from "@app/common/pure";
import { UserMessageAttachmentsView } from "../../pure/thread/UserMessageView";
import { CopyMessageButton } from "./CopyMessageButton";
import { TranscriptImageStrip } from "./TranscriptImages";
import styles from "./Transcript.module.css";

export function UserMessageBubble({
  blockId,
  cwd,
  attachments,
  images,
  markdownComponents,
  text
}: {
  attachments?: readonly CodexTranscriptAttachment[];
  blockId?: string;
  cwd?: string;
  images?: readonly CodexTranscriptImage[];
  markdownComponents?: MarkdownComponents;
  text: string;
}) {
  return (
    <MessageArticle
      cwd={cwd}
      blockId={blockId}
      markdownComponents={markdownComponents}
      message={{ role: "user", text, attachments: attachments ?? [], images: images ?? [] }}
    />
  );
}

export function AssistantMessage({
  blockId,
  cwd,
  final = true,
  markdownComponents,
  text
}: {
  blockId?: string;
  cwd?: string;
  final?: boolean;
  markdownComponents?: MarkdownComponents;
  text: string;
}) {
  return (
    <MessageArticle
      cwd={cwd}
      blockId={blockId}
      final={final}
      markdownComponents={markdownComponents}
      message={{ role: "assistant", text, attachments: [], images: [] }}
      overlay={final ? <CopyMessageButton text={text} /> : null}
    />
  );
}

export function MessageArticle({
  blockId,
  cwd,
  final = false,
  markdownComponents,
  message,
  overlay,
  trailing
}: {
  blockId?: string;
  cwd?: string;
  final?: boolean;
  markdownComponents?: MarkdownComponents;
  message: {
    role: "user" | "assistant" | "system";
    text: string;
    attachments?: readonly CodexTranscriptAttachment[];
    images?: readonly CodexTranscriptImage[];
  };
  overlay?: ReactNode;
  trailing?: ReactNode;
}) {
  const resolvedMarkdownComponents = useResolvedMarkdownComponents(markdownComponents, cwd);
  const hasOverlay = Boolean(overlay);

  return (
    <article
      aria-label={`${message.role} message`}
      className={[styles.message, styles[`message_${message.role}`], final ? styles.message_final : "", hasOverlay ? styles.message_withOverlay : ""]
        .filter(Boolean)
        .join(" ")}
      data-row-final={final ? "true" : undefined}
      data-block-id={blockId}
      data-row-role={message.role}
      data-row-type="message"
      data-testid={`transcript-${message.role}-message`}
    >
      {overlay}
      {message.images?.length ? <TranscriptImageStrip blockId={blockId} compact images={message.images} /> : null}
      {message.attachments?.length ? <MessageAttachments attachments={message.attachments} /> : null}
      {message.text ? <Markdown components={resolvedMarkdownComponents} text={message.text} /> : null}
      {trailing}
    </article>
  );
}

function MessageAttachments({ attachments }: { attachments: readonly CodexTranscriptAttachment[] }) {
  return (
    <UserMessageAttachmentsView
      attachments={[...attachments]}
    />
  );
}

function useResolvedMarkdownComponents(components: MarkdownComponents | undefined, cwd: string | undefined): MarkdownComponents | undefined {
  void cwd;
  return useMemo(() => components, [components]);
}
