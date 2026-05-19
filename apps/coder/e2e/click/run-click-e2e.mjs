import { readdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const clickDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(clickDir, "../..");
const keepRuns = Number.parseInt(process.env.CODER_E2E_KEEP_RUNS ?? "10", 10);
const runId = process.env.CODER_E2E_RUN_ID ?? new Date().toISOString().replace(/[:.]/g, "-");
const outputRoot = resolve(appDir, "test-results/click");
const outputDir = resolve(outputRoot, runId);
const passthroughArgs = process.argv.slice(2);
if (passthroughArgs[0] === "--") {
  passthroughArgs.shift();
}

if (process.env.CODER_E2E_KILL_SERVER === "1") {
  const port = Number.parseInt(process.env.CODER_E2E_PORT ?? "5173", 10);
  await killPort(port);
}
await pruneOldRuns(outputRoot, keepRuns - 1);

console.log(`[click-e2e] run id: ${runId}`);
console.log(`[click-e2e] output: ${outputDir}`);

let exitCode = 0;
const playwrightEnv = {
  ...process.env,
  CODER_E2E_RUN_ID: runId,
  PLAYWRIGHT_OUTPUT_DIR: outputDir
};

if (passthroughArgs.length > 0) {
  exitCode = await runPlaywright(passthroughArgs, playwrightEnv);
} else {
  for (const suite of ["live-chat-activity.spec.ts", "latest-threads.spec.ts"]) {
    exitCode = await runPlaywright([suite], playwrightEnv);
    if (exitCode !== 0) {
      break;
    }
  }
}

await pruneOldRuns(outputRoot, keepRuns);

if (exitCode !== 0) {
  console.error(`[click-e2e] failed; artifacts: ${outputDir}`);
  console.error("[click-e2e] if Chromium is missing, run: pnpm --filter @taylordb/coder exec playwright install chromium");
  process.exit(exitCode);
}

console.log(`[click-e2e] passed; artifacts: ${outputDir}`);

async function killPort(portNumber) {
  const pids = await commandOutput("lsof", ["-ti", `tcp:${portNumber}`]).catch(() => "");
  for (const pid of pids.split(/\s+/).filter(Boolean)) {
    try {
      process.kill(Number(pid), "SIGTERM");
    } catch {
      // The process may have already exited.
    }
  }
}

async function pruneOldRuns(root, keep) {
  if (!Number.isFinite(keep) || keep < 1) {
    return;
  }

  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const runDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();

  await Promise.all(runDirs.slice(keep).map((name) => rm(resolve(root, name), {
    force: true,
    recursive: true
  })));
}

function run(command, args, env) {
  return new Promise((resolveExitCode) => {
    const child = spawn(command, args, {
      cwd: appDir,
      env,
      shell: false,
      stdio: "inherit"
    });
    child.on("exit", (code) => resolveExitCode(code ?? 1));
  });
}

function runPlaywright(args, env) {
  return run("pnpm", [
    "exec",
    "playwright",
    "test",
    "-c",
    "e2e/click/playwright.config.ts",
    ...args
  ], env);
}

function commandOutput(command, args) {
  return new Promise((resolveOutput, rejectOutput) => {
    const child = spawn(command, args, {
      cwd: appDir,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolveOutput(stdout);
      } else {
        rejectOutput(new Error(stderr || `${command} exited with ${code}`));
      }
    });
  });
}
