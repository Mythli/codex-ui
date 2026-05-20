import type { CodexAssetHelper } from "../../assets/index.js";
import { defaultMarkdownRewriteHandlers } from "./handlers/index.js";
import { rewriteMarkdownAssetUrls } from "./rewrite-markdown.js";
import type { MarkdownRewriteHandler } from "./types.js";

export type MarkdownAssetProcessor = ReturnType<typeof createMarkdownAssetProcessor>;

export function createMarkdownAssetProcessor(options: {
  assets: CodexAssetHelper;
  diagnostic?: (text: string) => void;
  handlers?: readonly MarkdownRewriteHandler[];
}) {
  const handlers = options.handlers ?? defaultMarkdownRewriteHandlers;

  return {
    rewrite(text: string, input: { cwd?: string; diagnostic?: (text: string) => void } = {}) {
      return rewriteMarkdownAssetUrls(text, {
        assets: options.assets,
        cwd: input.cwd,
        diagnostic: input.diagnostic ?? options.diagnostic,
        handlers,
        readFile: async () => undefined
      });
    }
  };
}
