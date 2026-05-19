import { describe, expect, it } from "vitest";
import { buildFileChangePatch } from "./fileChangePatch.js";

describe("buildFileChangePatch", () => {
  it("wraps hunk-only update diffs with git headers", () => {
    expect(buildFileChangePatch([
      {
        path: "src/app.ts",
        diff: "@@ -1 +1 @@\n-old\n+new\n",
        kind: { type: "update", move_path: null }
      }
    ])).toBe([
      "diff --git a/src/app.ts b/src/app.ts",
      "--- a/src/app.ts",
      "+++ b/src/app.ts",
      "@@ -1 +1 @@",
      "-old",
      "+new",
      ""
    ].join("\n"));
  });

  it("preserves already complete git diffs", () => {
    const diff = "diff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n@@ -1 +1 @@\n-a\n+b\n";
    expect(buildFileChangePatch([{ path: "a.txt", diff }])).toBe(diff);
  });

  it("builds add-file patches when content is available", () => {
    expect(buildFileChangePatch([
      { path: "new.txt", content: "hello\nworld\n", kind: { type: "add" } }
    ])).toContain("--- /dev/null\n+++ b/new.txt\n@@ -0,0 +1,2 @@\n+hello\n+world\n");
  });

  it("builds delete-file patches when content is available", () => {
    expect(buildFileChangePatch([
      { path: "old.txt", content: "gone\n", kind: { type: "delete" } }
    ])).toContain("--- a/old.txt\n+++ /dev/null\n@@ -1,1 +0,0 @@\n-gone\n");
  });

  it("fails when a change has no reversible patch data", () => {
    expect(() => buildFileChangePatch([{ path: "missing.ts" }])).toThrow("Cannot revert file without a diff");
  });
});
