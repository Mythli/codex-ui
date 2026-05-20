import type { ReactNode } from "react";
import styles from "@app/common/pure/codex.module.css";

export function MessageBubbleView({
  message
}: {
  message: {
    id: string;
    role: "user" | "assistant";
    body: ReactNode;
  };
}) {
  return (
    <article
      aria-label={`${message.role} message`}
      className={[
        styles.message,
        message.role === "user" ? styles.messageUser : styles.messageAssistant
      ].join(" ")}
    >
      {message.body}
    </article>
  );
}
