import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const host = process.env.DEV_SERVER_HOST ?? "127.0.0.1";
const port = process.env.DEV_SERVER_PORT ?? "5173";

process.env.DEV_SERVER_CWD ??= appRoot;
process.env.DEV_SERVER_SESSION ??= "codex-api-dev";
process.env.DEV_SERVER_LABEL ??= "dev-server";
process.env.DEV_SERVER_LOG ??= "logs/dev-server.log";
process.env.DEV_SERVER_HOST = host;
process.env.DEV_SERVER_PORT = port;
process.env.DEV_SERVER_COMMAND ??= `pnpm exec vite dev --host ${shellQuote(host)} --port ${port} --strictPort`;

await import("../../../scripts/managed-dev-server.mjs");

function shellQuote(value) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
