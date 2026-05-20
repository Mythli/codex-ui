import type { ComponentProps } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import styles from "./Markdown.module.css";

export type MarkdownComponents = Components;

const defaultComponents: MarkdownComponents = {
  a: DefaultMarkdownLink
};

// Keep anchor behavior explicit for safer markdown links.
export function Markdown({
  components,
  text
}: {
  components?: MarkdownComponents;
  text: string;
}) {
  const resolvedComponents = components?.a
    ? components
    : { ...defaultComponents, ...components };

  return (
    <div className={styles.markdown}>
      <ReactMarkdown components={resolvedComponents}>{text}</ReactMarkdown>
    </div>
  );
}

function DefaultMarkdownLink({
  children,
  rel,
  target,
  ...props
}: ComponentProps<"a">) {
  return (
    <a
      {...props}
      rel={rel ?? "noopener noreferrer"}
      target={target ?? "_blank"}
    >
      {children}
    </a>
  );
}
