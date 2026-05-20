import type { CodexTransport } from "../types/index.js";
import type { CodexAssetHelper } from "../assets/index.js";
import { createLocalFileReadMiddleware } from "./createLocalFileReadMiddleware.js";
import { createTrafficMeasurementMiddleware } from "./createTrafficMeasurementMiddleware.js";
import { createMarkdownRewriteMiddleware, type MarkdownRewriteHandler } from "./markdown-rewrite/index.js";
import type { CodexProtocolMiddleware } from "./types.js";

export type CodexProtocolMiddlewareStackInput = {
  onDiagnostic?: (text: string) => void;
  transport: CodexTransport;
};

export type CodexProtocolMiddlewareStackFactory = (
  input: CodexProtocolMiddlewareStackInput
) => readonly CodexProtocolMiddleware[];

export type CodexProtocolMiddlewareStackOptions = {
  assetHelper: CodexAssetHelper;
  markdownRewriteHandlers: readonly MarkdownRewriteHandler[];
} & CodexProtocolMiddlewareStackInput;

export function createCodexProtocolMiddlewareStack(options: CodexProtocolMiddlewareStackOptions) {
  return [
    createLocalFileReadMiddleware({
      transport: options.transport,
      onDiagnostic: options.onDiagnostic
    }),
    createMarkdownRewriteMiddleware({
      assets: options.assetHelper,
      handlers: options.markdownRewriteHandlers,
      onDiagnostic: options.onDiagnostic
    }),
    createTrafficMeasurementMiddleware({
      onDiagnostic: options.onDiagnostic
    })
  ] as const;
}
