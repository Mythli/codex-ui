import { createAction } from "@reduxjs/toolkit";
import type { CodexProtocolTraffic } from "@taylordb/codex/protocol";

export const codexTrafficReceived = createAction<CodexProtocolTraffic>("coder/codex/trafficReceived");
