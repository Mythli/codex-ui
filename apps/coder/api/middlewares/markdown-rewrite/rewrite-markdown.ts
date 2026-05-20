import { fromMarkdown } from "mdast-util-from-markdown";
import { toMarkdown } from "mdast-util-to-markdown";
import { visit } from "unist-util-visit";
import type { Root } from "mdast";
import type {
  MarkdownRewriteContext,
  MarkdownUrlNode
} from "./types.js";

export function rewriteMarkdownAssetUrls(
  text: string,
  context: MarkdownRewriteContext
): string {
  if (!text) {
    return text;
  }

  let tree: Root;
  try {
    tree = fromMarkdown(text);
  } catch {
    return text;
  }

  let changed = false;
  visit(tree, ["image", "link", "definition"], (node) => {
    for (const handler of context.handlers) {
      changed = handler(node as MarkdownUrlNode, context) || changed;
    }
  });

  return changed ? toMarkdown(tree) : text;
}
