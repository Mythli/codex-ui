export type CodexFilePatchChange = {
  path: string;
  action?: string;
  content?: string;
  diff?: string;
  kind?: {
    type?: string;
    move_path?: string | null;
  };
};

export function buildFileChangePatch(changes: readonly CodexFilePatchChange[]): string {
  const patch = changes.map(filePatch).filter(Boolean).join("\n");
  if (!patch.trim()) {
    throw new Error("Cannot revert file changes without patch data.");
  }
  return patch.endsWith("\n") ? patch : `${patch}\n`;
}

function filePatch(change: CodexFilePatchChange): string {
  const diff = change.diff?.trimEnd();
  if (diff?.startsWith("diff --git ")) {
    return `${diff}\n`;
  }

  const kind = change.kind?.type ?? actionKind(change.action);
  if (kind === "add") {
    if (change.content !== undefined) {
      return addFilePatch(change.path, change.content);
    }
    throw new Error(`Cannot revert added file without original patch content: ${change.path}`);
  }
  if (kind === "delete") {
    if (change.content !== undefined) {
      return deleteFilePatch(change.path, change.content);
    }
    throw new Error(`Cannot revert deleted file without original file content: ${change.path}`);
  }

  if (!diff) {
    throw new Error(`Cannot revert file without a diff: ${change.path}`);
  }
  if (!diff.startsWith("@@")) {
    throw new Error(`Cannot revert unsupported diff format: ${change.path}`);
  }

  const nextPath = change.kind?.move_path ?? change.path;
  return [
    `diff --git a/${change.path} b/${nextPath}`,
    `--- a/${change.path}`,
    `+++ b/${nextPath}`,
    `${diff}\n`
  ].join("\n");
}

function addFilePatch(path: string, content: string): string {
  const lines = contentLines(content);
  return [
    `diff --git a/${path} b/${path}`,
    "new file mode 100644",
    "--- /dev/null",
    `+++ b/${path}`,
    `@@ -0,0 +1,${lines.length} @@`,
    ...lines.map((line) => `+${line}`),
    ""
  ].join("\n");
}

function deleteFilePatch(path: string, content: string): string {
  const lines = contentLines(content);
  return [
    `diff --git a/${path} b/${path}`,
    "deleted file mode 100644",
    `--- a/${path}`,
    "+++ /dev/null",
    `@@ -1,${lines.length} +0,0 @@`,
    ...lines.map((line) => `-${line}`),
    ""
  ].join("\n");
}

function contentLines(content: string): string[] {
  if (content === "") {
    return [];
  }
  return content.replace(/\n$/, "").split("\n");
}

function actionKind(action: string | undefined): string | undefined {
  const normalized = action?.toLowerCase();
  if (normalized === "added" || normalized === "created") {
    return "add";
  }
  if (normalized === "deleted" || normalized === "removed") {
    return "delete";
  }
  return normalized;
}
