import type { MarkdownRewriteContext } from "./types.js";

export function registerMarkdownTarget(
  rawTarget: string | null | undefined,
  context: MarkdownRewriteContext,
  options: { allowDataUrl: boolean }
): string | undefined {
  if (!rawTarget) {
    return undefined;
  }

  const target = rawTarget.trim();
  if (options.allowDataUrl && target.startsWith("data:")) {
    const registered = context.assets.urlForDataUrl(target);
    return registered?.asset.url;
  }

  try {
    return context.assets.urlForFileTarget(target, { cwd: context.cwd, originalPath: target })?.url;
  } catch {
    return undefined;
  }
}
