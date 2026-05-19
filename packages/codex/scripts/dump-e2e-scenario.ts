import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { AppServerClient } from "../src/server/AppServerClient.js";
import { runCodexScenarioCapture } from "../src/core/CodexScenarioFixture.js";
import {
  standardScenarioActions,
  standardScenarioFixtureCwd
} from "../src/core/standardScenarioFixture.js";

const tinyPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutDir = path.join(packageRoot, "src/core/__fixtures__");

const args = parseArgs(process.argv.slice(2));
const fixtureCwd = args.cwd ?? standardScenarioFixtureCwd;
const outPath = args.out ?? path.join(args.outDir ?? defaultOutDir, "standard.scenario.json");
const codexBin = args.codexBin ?? "codex";

if (args.only && args.only !== "standard") {
  throw new Error(`Only the standard scenario is supported by the scenario dumper, got: ${args.only}`);
}

await prepareStandardFixtureWorkspace(fixtureCwd);
const codexVersion = await getCodexVersion(codexBin);
const client = new AppServerClient(codexBin, { cwd: packageRoot });
const capture = await runCodexScenarioCapture({
  transport: client,
  id: "standard",
  codexVersion,
  steps: args.skipArchive
    ? standardScenarioActions.filter((action) => action.intent !== "archiveThread")
    : standardScenarioActions
});

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, `${JSON.stringify(capture.fixture, null, 2)}\n`, "utf8");
console.log(`Wrote Codex standard e2e scenario: ${outPath}`);

async function prepareStandardFixtureWorkspace(cwd: string): Promise<void> {
  await mkdir(cwd, { recursive: true });
  await writeFile(path.join(cwd, "sentinel.txt"), "sentinel-output\n", "utf8");
  await writeFile(path.join(cwd, "fixture-output-a.txt"), "placeholder\n", "utf8");
  await writeFile(path.join(cwd, "fixture-output-b.txt"), "placeholder\n", "utf8");
  await writeFile(path.join(cwd, "fixture-output-c.txt"), "placeholder\n", "utf8");
  await writeFile(path.join(cwd, "fixture-image.png"), Buffer.from(tinyPngBase64, "base64"));
}

function getCodexVersion(binary: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, ["--version"], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Codex version command failed: ${stderr.trim() || code}`));
        return;
      }
      const match = stdout.trim().match(/\b(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)\b/);
      if (!match?.[1]) {
        reject(new Error(`Could not parse Codex version from: ${stdout.trim() || "(empty output)"}`));
        return;
      }
      resolve(match[1]);
    });
  });
}

function parseArgs(values: string[]): {
  codexBin?: string;
  cwd?: string;
  only?: string;
  out?: string;
  outDir?: string;
  skipArchive?: boolean;
} {
  const parsed: ReturnType<typeof parseArgs> = {};
  for (let index = 0; index < values.length; index += 1) {
    const arg = values[index];
    if (arg === "--") {
      continue;
    } else if (arg === "--codex-bin") {
      parsed.codexBin = requiredValue(values, ++index, arg);
    } else if (arg === "--cwd") {
      parsed.cwd = requiredValue(values, ++index, arg);
    } else if (arg === "--only") {
      parsed.only = requiredValue(values, ++index, arg);
    } else if (arg === "--out") {
      parsed.out = requiredValue(values, ++index, arg);
    } else if (arg === "--out-dir") {
      parsed.outDir = requiredValue(values, ++index, arg);
    } else if (arg === "--skip-archive") {
      parsed.skipArchive = true;
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function requiredValue(values: string[], index: number, flag: string): string {
  const value = values[index];
  if (!value) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function printUsage(): void {
  console.log(`Usage: pnpm --filter @taylordb/codex dump:e2e [options]

Options:
  --codex-bin <path>  Codex binary to execute. Defaults to codex
  --cwd <path>        Fixture workspace. Defaults to ${standardScenarioFixtureCwd}
  --out <path>        Scenario output path. Defaults to src/core/__fixtures__/standard.scenario.json
  --out-dir <path>    Output directory for the standard scenario
  --only standard     Capture the standard scenario
  --skip-archive      Leave dumped thread unarchived for manual inspection
`);
}
