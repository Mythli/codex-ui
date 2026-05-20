import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const optionalString = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().optional()
);

const nonEmptyString = (defaultValue: string) => z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().min(1).default(defaultValue)
);

const positiveInt = (defaultValue: number) => z.preprocess(
  (value) => value === "" || value === undefined || value === null ? undefined : value,
  z.coerce.number().int().positive().default(defaultValue)
);

const jsonStringArray = (defaultValue = "[]") => z.preprocess(
  (value) => value === undefined || value === null || value === "" ? defaultValue : value,
  z.string().transform((value, context) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expected JSON string array"
      });
      return z.NEVER;
    }

    if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expected JSON string array"
      });
      return z.NEVER;
    }
    return parsed;
  })
);

const rawCoderApiEnvSchema = z.object({
  CODEX_APP_SERVER_ARGS_JSON: jsonStringArray(),
  CODEX_APP_SERVER_SOCKET_PATH: nonEmptyString("/app-socket"),
  CODEX_APP_SERVER_UNIX_SOCKET_PATH: optionalString,
  CODEX_APP_SERVER_URL: optionalString,
  CODEX_ASSET_CACHE_DIR: optionalString,
  CODEX_ASSET_ROUTE_BASE: nonEmptyString("/codex-assets"),
  CODEX_BACKEND_TRANSPORT: z.enum(["managed", "socket"]).default("managed"),
  CODEX_BIN: optionalString,
  CODEX_BIN_ARGS_JSON: jsonStringArray(),
  CODEX_HOME: optionalString,
  CODEX_SOCKET_LARGE_PACKET_BYTES: positiveInt(1_000_000),
  CODEX_SOCKET_PATH: nonEmptyString("/app-socket"),
  CODEX_SOCKET_REQUEST_TIMEOUT_MS: positiveInt(12_000),
  CODEX_SOCKET_SLOW_NOTIFY_MS: positiveInt(1_000),
  CODEX_SOCKET_SLOW_REQUEST_MS: positiveInt(500)
}).superRefine((env, context) => {
  if (env.CODEX_BACKEND_TRANSPORT === "socket" && !env.CODEX_APP_SERVER_URL) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "CODEX_APP_SERVER_URL is required when CODEX_BACKEND_TRANSPORT=socket",
      path: ["CODEX_APP_SERVER_URL"]
    });
  }

  if (env.CODEX_APP_SERVER_URL) {
    try {
      new URL(env.CODEX_APP_SERVER_URL);
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CODEX_APP_SERVER_URL must be a valid URL",
        path: ["CODEX_APP_SERVER_URL"]
      });
    }
  }

  if (env.CODEX_BACKEND_TRANSPORT !== "socket" && env.CODEX_APP_SERVER_UNIX_SOCKET_PATH) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "CODEX_APP_SERVER_UNIX_SOCKET_PATH is only supported when CODEX_BACKEND_TRANSPORT=socket",
      path: ["CODEX_APP_SERVER_UNIX_SOCKET_PATH"]
    });
  }
});

export type CoderApiEnv = {
  appServerArgs: string[];
  appServerSocketPath: string;
  appServerUnixSocketPath?: string;
  appServerUrl?: string;
  assetCacheDir: string;
  assetRouteBase: string;
  backendTransport: "managed" | "socket";
  codexBin?: string;
  codexBinArgs: string[];
  codexHome: string;
  socketLargeOutgoingPacketBytes: number;
  socketPath: string;
  socketRequestTimeoutMs: number;
  socketSlowNotifyMs: number;
  socketSlowRequestMs: number;
};

export function parseCoderApiEnv(input: NodeJS.ProcessEnv = process.env): CoderApiEnv {
  const env = rawCoderApiEnvSchema.parse(input);
  const codexHome = env.CODEX_HOME ?? join(homedir(), ".codex");
  return {
    appServerArgs: env.CODEX_APP_SERVER_ARGS_JSON,
    appServerSocketPath: env.CODEX_APP_SERVER_SOCKET_PATH,
    appServerUnixSocketPath: env.CODEX_APP_SERVER_UNIX_SOCKET_PATH,
    appServerUrl: env.CODEX_APP_SERVER_URL,
    assetCacheDir: env.CODEX_ASSET_CACHE_DIR ?? join(codexHome, "codex-api-assets"),
    assetRouteBase: env.CODEX_ASSET_ROUTE_BASE,
    backendTransport: env.CODEX_BACKEND_TRANSPORT,
    codexBin: env.CODEX_BIN,
    codexBinArgs: env.CODEX_BIN_ARGS_JSON,
    codexHome,
    socketLargeOutgoingPacketBytes: env.CODEX_SOCKET_LARGE_PACKET_BYTES,
    socketPath: env.CODEX_SOCKET_PATH,
    socketRequestTimeoutMs: env.CODEX_SOCKET_REQUEST_TIMEOUT_MS,
    socketSlowNotifyMs: env.CODEX_SOCKET_SLOW_NOTIFY_MS,
    socketSlowRequestMs: env.CODEX_SOCKET_SLOW_REQUEST_MS
  };
}
