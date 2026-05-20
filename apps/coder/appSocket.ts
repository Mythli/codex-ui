import type { Plugin, PreviewServer, ViteDevServer } from "vite";
import {
  codexAssetRef,
  type CodexAssetHelper,
  createAssetHttpHandler
} from "./assets/index.js";
import { getDependencies } from "./dependencies.js";

export function appSocketPlugin(path?: string): Plugin {
  const dependencies = getDependencies();
  return {
    name: "app-socket-bridge",
    configureServer(server) {
      installAppSocketBridge(server, dependencies, path);
    },
    configurePreviewServer(server) {
      installCodexAssetRoutes(server, dependencies.assetHelper);
    }
  };
}

function installAppSocketBridge(
  server: ViteDevServer,
  dependencies: ReturnType<typeof getDependencies>,
  path?: string
) {
  if (!server.httpServer) {
    return;
  }

  installCodexAssetRoutes(server, dependencies.assetHelper);

  const io = dependencies.createSocketServer(server.httpServer, path);
  const codexServer = dependencies.attachCodexNamespace(io.of("/codex"));

  server.httpServer.once("close", () => {
    codexServer.close();
    io.close();
  });
}

function installCodexAssetRoutes(server: ViteDevServer | PreviewServer, assetHelper: CodexAssetHelper) {
  server.middlewares.use(`${assetHelper.routeBase}/register`, (request, response) => {
    if (request.method !== "POST") {
      response.statusCode = 405;
      response.end("Method not allowed");
      return;
    }

    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    request.on("end", () => {
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
          dataUrl?: unknown;
          mimeType?: unknown;
          originalName?: unknown;
          path?: unknown;
        };
        const mimeType = typeof payload.mimeType === "string" ? payload.mimeType : undefined;
        const originalName = typeof payload.originalName === "string" ? payload.originalName : undefined;
        const registered = typeof payload.dataUrl === "string"
          ? assetHelper.registerDataUrl(payload.dataUrl, { originalName })?.asset
          : typeof payload.path === "string"
            ? assetHelper.registerFile(payload.path, { mimeType, originalPath: payload.path })
            : undefined;

        if (!registered) {
          response.statusCode = 400;
          response.end("Missing asset input");
          return;
        }

        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.end(JSON.stringify({ asset: registered }));
      } catch (error) {
        response.statusCode = 400;
        response.end(error instanceof Error ? error.message : "Could not register asset");
      }
    });
  });

  server.middlewares.use(`${assetHelper.routeBase}/upload`, (request, response) => {
    if (request.method !== "POST") {
      response.statusCode = 405;
      response.end("Method not allowed");
      return;
    }

    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    request.on("end", () => {
      const mimeType = request.headers["content-type"]?.split(";")[0] || "application/octet-stream";
      const originalName = typeof request.headers["x-file-name"] === "string" ? request.headers["x-file-name"] : undefined;
      const staged = assetHelper.stageBytesAsFile(Buffer.concat(chunks), { mimeType, originalName });
      const input = mimeType.startsWith("image/")
        ? { type: "localImage", path: staged.path, asset: codexAssetRef(staged.asset) }
        : undefined;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify({
        input,
        path: staged.path,
        asset: staged.asset
      }));
    });
  });
  server.middlewares.use(assetHelper.routeBase, createAssetHttpHandler(assetHelper));
}
