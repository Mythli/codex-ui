import { createAction } from "@reduxjs/toolkit";
import type { CodexProtocolTraffic } from "@coder/types";

export const codexTrafficReceived = createAction<CodexProtocolTraffic>("coder/codex/trafficReceived");
