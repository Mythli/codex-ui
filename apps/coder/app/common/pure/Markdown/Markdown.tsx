import type { ComponentProps } from "react";
import ReactMarkdown, { defaultUrlTransform, type Components, type UrlTransform } from "react-markdown";
import styles from "./Markdown.module.css";

export type MarkdownComponents = Components;
export type MarkdownUrlTransform = UrlTransform;

const defaultComponents: MarkdownComponents = {
  a: DefaultMarkdownLink
};

export function Markdown({
  components,
  text,
  urlTransform
}: {
  components?: MarkdownComponents;
  text: string;
  urlTransform?: MarkdownUrlTransform;
}) {
  const transform: MarkdownUrlTransform = urlTransform
    ? (url, key, node) => urlTransform(url, key, node) ?? defaultUrlTransform(url)
    : defaultUrlTransform;
  const resolvedComponents = components?.a
    ? components
    : { ...defaultComponents, ...components };

  return (
    <div className={styles.markdown}>
      <ReactMarkdown components={resolvedComponents} urlTransform={transform}>{text}</ReactMarkdown>
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
