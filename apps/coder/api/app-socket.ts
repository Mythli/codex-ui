import { Server } from "socket.io";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";
import {
  createCodexAssetHttpHandler,
  createCodexAssetRegistry
} from "./middlewares/assets/index.js";
import { AppCodexSessionRegistry, attachAppCodexNamespace } from "./codex-socket.js";
import { attachFixturePlayback } from "./fixture-playback/index.js";
import { attachGitObserverNamespace } from "../../../packages/git-observer/src/server";

const codexAssets = createCodexAssetRegistry();

export function appSocketPlugin(path = "/app-socket"): Plugin {
  return {
    name: "app-socket-bridge",
    configureServer(server) {
      installAppSocketBridge(server, path);
    },
    configurePreviewServer(server) {
      installCodexAssetRoutes(server);
    }
  };
}

function installAppSocketBridge(server: ViteDevServer, path: string) {
  if (!server.httpServer) {
    return;
  }

  installCodexAssetRoutes(server);

  const io = new Server(server.httpServer, {
    path,
    cors: {
      origin: true
    }
  });

  const sessions = new AppCodexSessionRegistry();
  const codexServer = attachAppCodexNamespace(io.of("/codex"), { assets: codexAssets, sessions });
  const fixturePlayback = attachFixturePlayback({ io, sessions });
  const gitServer = attachGitObserverNamespace(io.of("/git"));

  server.httpServer.once("close", () => {
    fixturePlayback.close();
    codexServer.close();
    void gitServer.close();
    io.close();
  });
}

function installCodexAssetRoutes(server: ViteDevServer | PreviewServer) {
  server.middlewares.use(`${codexAssets.routeBase}/upload`, (request, response) => {
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
      const staged = codexAssets.stageBytesAsFile(Buffer.concat(chunks), { mimeType, originalName });
      const input = mimeType.startsWith("image/")
        ? { type: "localImage", path: staged.path }
        : undefined;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify({
        input,
        path: staged.path,
        asset: staged.asset
      }));
    });
  });
  server.middlewares.use(codexAssets.routeBase, createCodexAssetHttpHandler(codexAssets));
}
