import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const host = process.env.DEV_SERVER_HOST ?? "127.0.0.1";
const port = process.env.DEV_SERVER_PORT ?? "6006";

process.env.DEV_SERVER_CWD ??= packageRoot;
process.env.DEV_SERVER_SESSION ??= "codex-api-storybook";
process.env.DEV_SERVER_LABEL ??= "storybook-server";
process.env.DEV_SERVER_LOG ??= "logs/storybook-server.log";
process.env.DEV_SERVER_HOST = host;
process.env.DEV_SERVER_PORT = port;
process.env.DEV_SERVER_COMMAND ??= `STORYBOOK_DISABLE_TELEMETRY=1 pnpm exec storybook dev --host ${shellQuote(host)} --port ${port} --no-open`;

await import("../../../scripts/managed-dev-server.mjs");

function shellQuote(value) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
