import type { CodexScenarioFixture } from "@taylordb/codex/server";
import standardScenario from "../../../../packages/codex/src/core/__fixtures__/standard.scenario.json";
import workTimelineScenario from "../../../../packages/codex/src/core/__fixtures__/work-timeline.scenario.json";
import type { FixturePlaybackDefinition, FixturePlaybackOption } from "./types.js";

const standardFixture = standardScenario as CodexScenarioFixture;
const workTimelineFixture = workTimelineScenario as CodexScenarioFixture;

export const fixturePlaybackDefinitions: FixturePlaybackDefinition[] = [
  {
    id: "standard-live",
    label: "Standard live stream",
    defaultMode: "live",
    fixture: standardFixture
  },
  {
    id: "standard-loaded",
    label: "Standard loaded thread",
    defaultMode: "loaded",
    fixture: standardFixture
  },
  {
    id: "work-timeline-loaded",
    label: "Work timeline loaded thread",
    defaultMode: "loaded",
    fixture: workTimelineFixture
  }
];

export function fixturePlaybackOptions(): FixturePlaybackOption[] {
  return fixturePlaybackDefinitions.map(({ id, label, defaultMode }) => ({ id, label, defaultMode }));
}

export function findFixturePlaybackDefinition(id: string | undefined): FixturePlaybackDefinition | undefined {
  if (!id) {
    return undefined;
  }
  const normalized = normalizeFixturePlaybackId(id);
  return fixturePlaybackDefinitions.find((definition) => definition.id === normalized);
}

export function normalizeFixturePlaybackId(id: string): string {
  if (!id || id === "true" || id === "1") {
    return "standard-live";
  }
  if (id === "standard" || id === "live") {
    return "standard-live";
  }
  if (id === "loaded") {
    return "standard-loaded";
  }
  if (id === "work-timeline" || id === "timeline") {
    return "work-timeline-loaded";
  }
  return id;
}

export function fixtureIdFromSearch(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const search = value.startsWith("?") ? value : `?${value}`;
  return new URLSearchParams(search).get("fixture") ?? undefined;
}
