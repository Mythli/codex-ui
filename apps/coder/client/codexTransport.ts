import { CodexSocketIoTransport } from "./CodexSocketIoTransport";
import { DEFAULT_CODEX_CWD } from "../defaults.js";
import type { CodexTransport } from "../types/index.js";
import { io, type Socket } from "socket.io-client";
import { getAppSocketAuth } from "../app/appSession";

export { DEFAULT_CODEX_CWD };

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
