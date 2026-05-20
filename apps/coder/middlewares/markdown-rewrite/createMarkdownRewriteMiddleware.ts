import type {
  CodexMiddlewareContext,
  CodexProtocolMiddleware
} from "../types.js";
import { rewriteResponseMarkdown, rewriteTrafficMarkdown } from "./protocol-rewrite.js";
import type {
  MarkdownRewriteContext,
  MarkdownRewriteMiddlewareOptions
} from "./types.js";

export function createMarkdownRewriteMiddleware(
  options: MarkdownRewriteMiddlewareOptions
): CodexProtocolMiddleware {
  const contextFor = (context: CodexMiddlewareContext): MarkdownRewriteContext => ({
    ...context,
    assets: options.assets,
    handlers: options.handlers,
    diagnostic: context.diagnostic ?? options.onDiagnostic
  });

  return {
    name: "markdown-rewrite",
    response: (request, response, context) =>
      rewriteResponseMarkdown(request.method, request.params, response, contextFor(context)),
    traffic: (traffic, context) => rewriteTrafficMarkdown(traffic, contextFor(context))
  };
}
