import { CodexSocketIoTransport } from "@taylordb/codex/browser";
import type { CodexTransport } from "@taylordb/codex";
import { io, type Socket } from "socket.io-client";
import { getAppSocketAuth } from "../../../core/appSession";

export const DEFAULT_CODEX_CWD = "/Users/tobiasanhalt/Development/codex-api";

type CodexTransportController = {
  socket: Socket;
  transport: CodexTransport;
};

let controller: CodexTransportController | undefined;

export function getCodexTransportController(): CodexTransportController {
  if (controller) {
    return controller;
  }
  const socket = io("/codex", {
    autoConnect: false,
    path: "/app-socket",
    transports: ["websocket"],
    upgrade: false,
    auth: getAppSocketAuth()
  });
  controller = {
    socket,
    transport: new CodexSocketIoTransport(socket)
  };
  return controller;
}

export function getCodexTransport(): CodexTransport {
  return getCodexTransportController().transport;
}
