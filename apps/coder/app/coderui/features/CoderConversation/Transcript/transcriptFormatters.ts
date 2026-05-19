import type { CodexRenderBlock } from "@taylordb/codex";

export function displayShellCommand(command: string): string {
  const trimmed = command.trim();
  const shellMatch = trimmed.match(/^\/bin\/(?:zsh|bash|sh)\s+-lc\s+(['"])([\s\S]*)\1$/);
  return shellMatch?.[2] ?? trimmed;
}

export function displayFileName(path: string, cwd: string | undefined): string {
  const relative = displayPath(path, cwd);
  return relative.split("/").at(-1) ?? relative;
}

export function displayPath(path: string, cwd: string | undefined): string {
  const normalizedCwd = cwd?.replace(/\/+$/, "");
  return normalizedCwd && path.startsWith(`${normalizedCwd}/`)
    ? path.slice(normalizedCwd.length + 1)
    : path;
}

export function getFileChangeAction(title: string, additions: number, deletions: number) {
  if (/creat/i.test(title) || (additions > 0 && deletions === 0)) {
    return "Creating";
  }
  if (/delet/i.test(title) || (deletions > 0 && additions === 0)) {
    return "Deleting";
  }
  return "Editing";
}

export function getFileChangePastAction(action: string | undefined, additions: number, deletions: number) {
  if (action === "added" || (additions > 0 && deletions === 0)) {
    return "Created";
  }
  if (action === "deleted" || (deletions > 0 && additions === 0)) {
    return "Deleted";
  }
  return "Edited";
}

export function formatDuration(durationMs: number | undefined) {
  if (!durationMs || durationMs < 1000) {
    return "a moment";
  }
  const seconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes === 0 ? `${seconds}s` : `${minutes}m ${remainder}s`;
}

export function blockSignature(blocks: readonly CodexRenderBlock[]) {
  return JSON.stringify(blocks);
}

export function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
