import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const outDir = path.join(root, "live-captures");
mkdirSync(outDir, { recursive: true });

const notes = [];
const boundsPath = path.join(outDir, "codex-window-bounds.json");
const screenshotPath = path.join(outDir, "codex-window.png");
const notesPath = path.join(outDir, "runtime-notes.md");

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

try {
  run("open", ["-a", "Codex"]);
  notes.push("- Launched `/Applications/Codex.app` via `open -a Codex`.");
} catch (error) {
  notes.push(`- Failed to launch Codex: ${error.message}`);
}

await new Promise((resolve) => setTimeout(resolve, 3500));

let bounds = null;
try {
  const raw = run("osascript", [
    "-e",
    [
      'tell application "System Events"',
      '  tell process "Codex"',
      "    set frontmost to true",
      "    if (count of windows) is 0 then error \"No Codex windows found\"",
      "    set w to window 1",
      "    set p to position of w",
      "    set s to size of w",
      '    return (item 1 of p as text) & "," & (item 2 of p as text) & "," & (item 1 of s as text) & "," & (item 2 of s as text)',
      "  end tell",
      "end tell",
    ].join("\n"),
  ]);
  const [x, y, width, height] = raw.split(",").map((value) => Number.parseInt(value, 10));
  bounds = { x, y, width, height };
  writeFileSync(boundsPath, JSON.stringify(bounds, null, 2) + "\n");
  notes.push(`- Captured frontmost Codex window bounds: ${JSON.stringify(bounds)}.`);
} catch (error) {
  notes.push(`- Could not read Codex window bounds through AppleScript: ${error.message}`);
}

if (bounds && bounds.width > 0 && bounds.height > 0) {
  const rect = `${bounds.x},${bounds.y},${bounds.width},${bounds.height}`;
  const result = spawnSync("screencapture", ["-x", "-R", rect, screenshotPath], { encoding: "utf8" });
  if (result.status === 0 && existsSync(screenshotPath)) {
    notes.push(`- Saved app-window screenshot to \`${path.relative(root, screenshotPath)}\`.`);
  } else {
    notes.push("- Screenshot capture failed. macOS Screen Recording permission may be required for the terminal/Codex process.");
  }
} else {
  notes.push("- Skipped screenshot because no valid Codex window bounds were available.");
}

notes.push("");
notes.push("## Runtime Capture Limitations");
notes.push("- This helper captures the visible native window, not internal React component state.");
notes.push("- DOM and computed-style extraction requires attaching to Electron DevTools/CDP or using an app-supported debug build.");

writeFileSync(notesPath, `# Runtime Notes\n\n${notes.join("\n")}\n`);
console.log(notes.join("\n"));
