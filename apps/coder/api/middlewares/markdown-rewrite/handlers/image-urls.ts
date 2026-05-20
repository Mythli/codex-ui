import { registerMarkdownTarget } from "../url-targets.js";
import type { MarkdownRewriteContext, MarkdownUrlNode } from "../types.js";

export function rewriteMarkdownImageUrls(
  node: MarkdownUrlNode,
  context: MarkdownRewriteContext
): boolean {
  if (node.type !== "image") {
    return false;
  }

  const assetUrl = registerMarkdownTarget(node.url, context, { allowDataUrl: true });
  if (!assetUrl) {
    return false;
  }
  node.url = assetUrl;
  return true;
}
