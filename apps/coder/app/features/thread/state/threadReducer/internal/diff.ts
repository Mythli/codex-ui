export function diffStat(diff: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) {
      continue;
    }
    if (line.startsWith("+")) {
      additions += 1;
    } else if (line.startsWith("-")) {
      deletions += 1;
    }
  }
  return { additions, deletions };
}

export function filesFromUnifiedDiff(diff: string): Array<{ path: string; additions: number; deletions: number; diff: string }> {
  const files: Array<{ path: string; additions: number; deletions: number; diff: string }> = [];
  let current:
    | { path: string; lines: string[] }
    | undefined;

  const flush = () => {
    if (!current) {
      return;
    }
    const fileDiff = current.lines.join("\n");
    files.push({
      path: current.path,
      ...diffStat(fileDiff),
      diff: fileDiff.endsWith("\n") ? fileDiff : `${fileDiff}\n`
    });
    current = undefined;
  };

  for (const line of diff.split("\n")) {
    const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (match) {
      flush();
      current = { path: match[2] ?? match[1] ?? "", lines: [line] };
      continue;
    }
    current?.lines.push(line);
  }
  flush();

  return files.filter((file) => file.path);
}

export function fileActionLabel(kind: string | undefined): string {
  if (!kind) return "modified";
  if (kind === "add") return "added";
  if (kind === "delete") return "deleted";
  if (kind === "rename") return "renamed";
  return kind;
}

export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function sentenceCase(value: string): string {
  return value ? `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}` : value;
}

export function joinParts(parts: readonly string[]): string {
  if (parts.length <= 2) {
    return parts.join(", ");
  }
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
