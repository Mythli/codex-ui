import type { CodexMessage } from "../types";
import { Markdown } from "./Markdown";

export function MessageBubble({ node }: { node: CodexMessage }) {
  return (
    <article className={`message ${node.role}`}>
      <strong>{node.role}</strong>
      <Markdown>{node.text}</Markdown>
    </article>
  );
}
