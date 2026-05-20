import { registerMarkdownTarget } from "../url-targets.js";
import type { MarkdownRewriteContext, MarkdownUrlNode } from "../types.js";

export function rewriteMarkdownLocalFileLinks(
  node: MarkdownUrlNode,
  context: MarkdownRewriteContext
): boolean {
  if (node.type !== "link" && node.type !== "definition") {
    return false;
  }

  const assetUrl = registerMarkdownTarget(node.url, context, { allowDataUrl: false });
  if (!assetUrl) {
    return false;
  }
  node.url = assetUrl;
  return true;
}
