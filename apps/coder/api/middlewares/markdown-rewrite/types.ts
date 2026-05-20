import type { Definition, Image, Link } from "mdast";
import type { CodexMiddlewareContext } from "../types.js";
import type { CodexAssetRegistry } from "../assets/CodexAssetRegistry.js";

export type MarkdownRewriteMiddlewareOptions = {
  assets: CodexAssetRegistry;
  handlers: readonly MarkdownRewriteHandler[];
  onDiagnostic?: (text: string) => void;
};

export type MarkdownRewriteContext = CodexMiddlewareContext & {
  assets: CodexAssetRegistry;
  handlers: readonly MarkdownRewriteHandler[];
};

export type MarkdownUrlNode = Image | Link | Definition;

export type MarkdownRewriteHandler = (
  node: MarkdownUrlNode,
  context: MarkdownRewriteContext
) => boolean;
