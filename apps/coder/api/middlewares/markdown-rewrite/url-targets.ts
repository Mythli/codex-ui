import { isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
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
    const registered = context.assets.registerDataUrl(target);
    return registered?.asset.url;
  }

  if (!isLocalFileReference(target, context)) {
    return undefined;
  }

  const path = localPathFromMarkdownTarget(target);
  try {
    return context.assets.registerFile(path, { cwd: context.cwd, originalPath: target }).url;
  } catch {
    return undefined;
  }
}

function isLocalFileReference(value: string, context: MarkdownRewriteContext): boolean {
  if (value.startsWith(`${context.assets.routeBase.replace(/\/+$/, "")}/`)) {
    return false;
  }
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
    return false;
  }
  if (value.startsWith("mailto:") || value.startsWith("#")) {
    return false;
  }
  return value.startsWith("/")
    || value.startsWith("./")
    || value.startsWith("../")
    || value.startsWith("file:")
    || /^[A-Za-z]:[\\/]/.test(value)
    || Boolean(context.cwd && /(^|\/)[^/\s]+\.[A-Za-z0-9]{1,8}(:\d+)?([?#].*)?$/.test(value));
}

function localPathFromMarkdownTarget(value: string): string {
  const filePath = value.startsWith("file:")
    ? fileUrlToPath(value)
    : value;
  return stripLineSuffix(stripQueryAndFragment(filePath));
}

function fileUrlToPath(value: string): string {
  try {
    return fileURLToPath(value);
  } catch {
    return value.replace(/^file:\/+/, isAbsolute(value) ? "/" : "");
  }
}

function stripQueryAndFragment(value: string): string {
  return value.split(/[?#]/, 1)[0] ?? value;
}

function stripLineSuffix(value: string): string {
  return value.replace(/:\d+(?::\d+)?$/, "");
}
