import type { CodexScenarioFixture } from "@taylordb/codex/server";

export type FixturePlaybackMode = "live" | "loaded";

export type FixturePlaybackDefinition = {
  id: string;
  label: string;
  defaultMode: FixturePlaybackMode;
  fixture: CodexScenarioFixture;
};

export type FixturePlaybackStatus = {
  fixtureId?: string;
  label?: string;
  mode?: FixturePlaybackMode;
  isRunning: boolean;
  currentStep: number;
  totalSteps: number;
  delayMs: number;
  error?: string;
};

export type FixturePlaybackOption = {
  id: string;
  label: string;
  defaultMode: FixturePlaybackMode;
};
