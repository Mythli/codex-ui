import ReactMarkdown, { type Components } from "react-markdown";
import styles from "./Markdown.module.css";

export type MarkdownComponents = Components;

export function Markdown({
  components,
  text
}: {
  components?: MarkdownComponents;
  text: string;
}) {
  return (
    <div className={styles.markdown}>
      <ReactMarkdown components={components}>{text}</ReactMarkdown>
    </div>
  );
}
