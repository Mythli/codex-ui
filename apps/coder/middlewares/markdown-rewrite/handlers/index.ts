import { rewriteMarkdownImageUrls } from "./image-urls.js";
import { rewriteMarkdownLocalFileLinks } from "./local-file-links.js";
import type { MarkdownRewriteHandler } from "../types.js";

export const defaultMarkdownRewriteHandlers: readonly MarkdownRewriteHandler[] = [
  rewriteMarkdownImageUrls,
  rewriteMarkdownLocalFileLinks
];

export { rewriteMarkdownImageUrls } from "./image-urls.js";
export { rewriteMarkdownLocalFileLinks } from "./local-file-links.js";
