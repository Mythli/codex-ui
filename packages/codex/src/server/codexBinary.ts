import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function resolveCodexBinary(): string {
  if (process.env.CODEX_BIN) {
    if (!existsSync(process.env.CODEX_BIN)) {
      throw new Error(`CODEX_BIN is set but does not exist: ${process.env.CODEX_BIN}`);
    }
    return process.env.CODEX_BIN;
  }

  const appBinary = "/Applications/Codex.app/Contents/Resources/codex";
  return existsSync(appBinary) ? appBinary : "codex";
}

export async function getCodexVersion(codexBin = resolveCodexBinary()): Promise<string> {
  const { stdout } = await execFileAsync(codexBin, ["--version"]);
  const output = stdout.trim();
  const match = output.match(/\b(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)\b/);
  if (!match?.[1]) {
    throw new Error(`Could not parse Codex version from: ${output || "(empty output)"}`);
  }
  return match[1];
}
