export type CoderConnectionState = {
  status: "idle" | "connecting" | "connected" | "disconnected" | "closed" | "failed";
  initialized: boolean;
  diagnostics: string[];
  closed?: { exitCode: number | null; signal: string | null };
  error?: string;
};
