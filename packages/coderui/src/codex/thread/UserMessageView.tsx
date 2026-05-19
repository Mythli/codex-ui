import type { ReactNode } from "react";
import type { CodexAttachment } from "../types";
import { AttachmentChip } from "../composer/AttachmentChip";
import styles from "../codex.module.css";
import { MessageBubbleView } from "./MessageBubbleView";
import { TranscriptImageStripView, type TranscriptImageViewItem } from "./TranscriptImageStripView";

export type UserMessageViewProps = {
  attachments?: CodexAttachment[];
  children?: ReactNode;
  id?: string;
  images?: TranscriptImageViewItem[];
};

export function UserMessageView({
  attachments = [],
  children,
  id = "user-message",
  images = []
}: UserMessageViewProps) {
  return (
    <MessageBubbleView
      message={{
        id,
        role: "user",
        body: (
          <UserMessageContentView attachments={attachments} images={images}>
            {children}
          </UserMessageContentView>
        )
      }}
    />
  );
}

export function UserMessageContentView({
  attachments = [],
  children,
  images = []
}: Omit<UserMessageViewProps, "id">) {
  return (
    <div className={styles.userMessageContent}>
      {images.length > 0 ? <TranscriptImageStripView images={images} /> : null}
      {attachments.length > 0 ? <UserMessageAttachmentsView attachments={attachments} /> : null}
      {children}
    </div>
  );
}

export function UserMessageAttachmentsView({ attachments }: { attachments: CodexAttachment[] }) {
  return (
    <div className={styles.userMessageAttachments} data-testid="user-message-attachments">
      {attachments.map((attachment) => (
        <AttachmentChip attachment={attachment} key={attachment.id} />
      ))}
    </div>
  );
}
