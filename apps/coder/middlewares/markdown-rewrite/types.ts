import type { Definition, Image, Link } from "mdast";
import type { CodexMiddlewareContext } from "../types.js";
import type { CodexAssetHelper } from "../../assets/index.js";

export type MarkdownRewriteMiddlewareOptions = {
  assets: CodexAssetHelper;
  handlers: readonly MarkdownRewriteHandler[];
  onDiagnostic?: (text: string) => void;
};

export type MarkdownRewriteContext = CodexMiddlewareContext & {
  assets: CodexAssetHelper;
  handlers: readonly MarkdownRewriteHandler[];
};

export type MarkdownUrlNode = Image | Link | Definition;

export type MarkdownRewriteHandler = (
  node: MarkdownUrlNode,
  context: MarkdownRewriteContext
) => boolean;
