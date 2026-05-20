export type CoderShellViewMode = "both" | "chat" | "preview";
export type PreviewViewport = "desktop" | "tablet" | "phone";

export type CoderModelsConfigState = {
  modelsStatus: "idle" | "loading" | "ready" | "failed";
  configStatus: "idle" | "loading" | "ready" | "failed";
  error?: string;
};
