import type { CodexMessage } from "../types";
import styles from "../codex.module.css";

export function MessageBubbleView({ message }: { message: CodexMessage }) {
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
