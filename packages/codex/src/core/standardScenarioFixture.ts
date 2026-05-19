import {
  planArchiveThread,
  planInitialize,
  planListThreads,
  planOpenThread,
  planStartThreadWithMessage,
  planTurnStart,
  type CodexRequestPlan
} from "./CodexActionPlanner.js";

export const standardScenarioFixtureCwd = "/tmp/codex-e2e";
export const standardScenarioFixtureSearch = "sentinel-output";
export const standardScenarioFixtureVersion = "standard-scenario-v1";

export const standardScenarioFirstMessage =
  "This is a fixture capture. Do not inspect files. Reply exactly: Hello from Codex.";
export const standardScenarioSingleToolMessage =
  "Fixture tool capture, step 1. First send one brief progress update explaining that you will read sentinel.txt. Then use exactly one tool call: run `cat sentinel.txt` in the current working directory. Then answer with only the command output.";
export const standardScenarioMultiToolMessage =
  "Fixture tool capture, step 2. First send one brief progress update explaining that you will edit three fixture output files, read them, and inspect the image. Then use exactly three tool calls, each with a different tool: first use apply_patch once to update fixture-output-a.txt, fixture-output-b.txt, and fixture-output-c.txt by replacing `placeholder` with `dynamic output a`, `dynamic output b`, and `dynamic output c`; second run `cat fixture-output-a.txt fixture-output-b.txt fixture-output-c.txt`; third inspect /tmp/codex-e2e/fixture-image.png with view_image. Then summarize the three file contents and image inspection briefly.";

export const standardScenarioActions: readonly CodexRequestPlan[] = [
  planInitialize(),
  planStartThreadWithMessage({
    cwd: standardScenarioFixtureCwd,
    input: [
      { type: "localImage", path: `${standardScenarioFixtureCwd}/fixture-image.png` },
      { type: "text", text: standardScenarioFirstMessage, text_elements: [] }
    ],
    sandbox: "read-only"
  }),
  planTurnStart({
    cwd: standardScenarioFixtureCwd,
    input: standardScenarioSingleToolMessage,
    sandbox: "read-only"
  }),
  planTurnStart({
    cwd: standardScenarioFixtureCwd,
    input: standardScenarioMultiToolMessage,
    sandbox: "danger-full-access"
  }),
  planListThreads({
    limit: 100,
    sortKey: "updated_at",
    sortDirection: "desc",
    sourceKinds: [],
    archived: false
  }),
  planListThreads({
    limit: 100,
    sortKey: "updated_at",
    sortDirection: "desc",
    sourceKinds: [],
    archived: false,
    searchTerm: standardScenarioFixtureSearch
  }),
  planOpenThread({
    includeTurns: true,
    readSessionFile: true
  }),
  planArchiveThread()
];
