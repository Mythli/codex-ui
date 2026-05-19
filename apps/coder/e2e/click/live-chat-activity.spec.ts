import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { ClickAppPage, type ClickSwitcherRow } from "./support/ClickAppPage";

const liveResponseTimeoutMs = 120_000;

test.describe("live chat activity click e2e", () => {
  test.setTimeout(360_000);

  test("orders live chats by message send and exposes running and unread rows", async ({ page }, testInfo) => {
    const app = new ClickAppPage(page, testInfo);
    const snapshots: Array<{ label: string; rows: ClickSwitcherRow[] }> = [];

    try {
      await app.gotoLiveApp();
      await app.screenshot("01-app-ready");

      await app.selectModelByNameOrId(/codex.*spark|codex-spark/i);
      await app.screenshot("02-codex-spark-selected");

      await app.createNewChat();
      await app.screenshot("03-chat-a-draft-created");

      await app.sendPrompt("Reply with exactly this text and no extra words: alpha-ready");
      const chatA = await app.currentThreadId(liveResponseTimeoutMs);
      await app.waitForRouteThreadId(chatA, liveResponseTimeoutMs);
      await app.screenshot("04-chat-a-first-prompt-sent");
      await app.waitForAssistantText("alpha-ready", liveResponseTimeoutMs);
      await app.screenshot("05-chat-a-first-answer");

      await page.waitForTimeout(500);
      await app.sendPrompt([
        "Run these two shell commands in order:",
        "sleep 1",
        "sleep 1",
        "After both commands complete, reply with exactly this text and no extra words: alpha-slept"
      ].join("\n"));
      await app.screenshot("06-chat-a-sleep-prompt-sent");

      await app.openSwitcher();
      const aRunningRows = await expectRows("chat A running after sleep prompt", app, snapshots, (rows) => {
        const scenarioRows = filterScenarioRows(rows, chatA);
        const row = findRow(scenarioRows, chatA);
        expect(row?.index).toBe(0);
        expect(row?.isRunning).toBe(true);
      });
      await app.screenshot("07-chat-a-running-in-switcher");
      await app.closeSwitcher();
      expect(aRunningRows[0]?.threadId).toBe(chatA);

      await app.createNewChat();
      await app.screenshot("08-chat-b-draft-created");
      await app.sendPrompt("Reply with exactly this text and no extra words: beta-ready");
      const chatB = await app.currentThreadId(liveResponseTimeoutMs);
      await app.waitForRouteThreadId(chatB, liveResponseTimeoutMs);
      await app.screenshot("09-chat-b-first-prompt-sent");

      await app.openSwitcher();
      await expectRows("chat B first and chat A background state visible", app, snapshots, (rows) => {
        expect(rows[0]?.threadId).toBe(chatB);
        const scenarioRows = filterScenarioRows(rows, chatA, chatB);
        const chatARow = findRow(scenarioRows, chatA);
        expect(Boolean(chatARow?.isRunning || chatARow?.isUnread)).toBe(true);
      });
      await app.screenshot("10-chat-b-first-chat-a-running");
      await app.closeSwitcher();

      await app.openSwitcher();
      await expectRowsEventually("chat A unread after background completion", app, snapshots, (rows) => {
        const scenarioRows = filterScenarioRows(rows, chatA, chatB);
        const chatARow = findRow(scenarioRows, chatA);
        return Boolean(chatARow?.isUnread && !chatARow.isRunning);
      }, 90_000);
      await app.screenshot("11-chat-a-unread-background-answer");
      await app.closeSwitcher();

      await app.waitForAssistantText("beta-ready");
      await app.screenshot("12-chat-b-answer");

      await app.openSwitcher();
      await expectRows("chat B selected without unread", app, snapshots, (rows) => {
        const scenarioRows = filterScenarioRows(rows, chatA, chatB);
        const chatBRow = findRow(scenarioRows, chatB);
        expect(chatBRow?.isUnread).toBe(false);
      });
      await app.closeSwitcher();

      await app.openChatById(chatA);
      await app.screenshot("13-chat-a-reopened");
      await app.waitForAssistantText("alpha-slept");
      await app.screenshot("14-chat-a-sleep-answer-visible");

      await app.openSwitcher();
      await expectRows("chat A unread cleared", app, snapshots, (rows) => {
        const scenarioRows = filterScenarioRows(rows, chatA, chatB);
        const chatARow = findRow(scenarioRows, chatA);
        expect(chatARow?.isUnread).toBe(false);
      });
      await app.closeSwitcher();

      await app.sendPrompt("Reply with exactly this text and no extra words: alpha-again");
      await app.screenshot("15-chat-a-third-prompt-sent");

      await app.openSwitcher();
      await expectRowsEventually("chat A first after third prompt", app, snapshots, (rows) =>
        rows[0]?.threadId === chatA,
      10_000);
      await app.screenshot("16-chat-a-first-again-running");
      await app.closeSwitcher();

      await app.waitForAssistantText("alpha-again");
      await app.screenshot("17-chat-a-third-answer");
      await app.expectNoAppError();
    } finally {
      const snapshotPath = testInfo.outputPath("live-chat-activity-switcher-snapshots.json");
      await writeFile(snapshotPath, JSON.stringify(snapshots, null, 2));
      await testInfo.attach("live-chat-activity-switcher-snapshots.json", {
        path: snapshotPath,
        contentType: "application/json"
      });
    }
  });
});

async function expectRows(
  label: string,
  app: ClickAppPage,
  snapshots: Array<{ label: string; rows: ClickSwitcherRow[] }>,
  assertion: (rows: ClickSwitcherRow[]) => void
): Promise<ClickSwitcherRow[]> {
  const rows = await app.readSwitcherRows();
  snapshots.push({ label, rows });
  assertion(rows);
  return rows;
}

async function expectRowsEventually(
  label: string,
  app: ClickAppPage,
  snapshots: Array<{ label: string; rows: ClickSwitcherRow[] }>,
  predicate: (rows: ClickSwitcherRow[]) => boolean,
  timeoutMs: number
): Promise<ClickSwitcherRow[]> {
  const deadline = Date.now() + timeoutMs;
  let lastRows: ClickSwitcherRow[] = [];
  while (Date.now() < deadline) {
    lastRows = await app.readSwitcherRows();
    snapshots.push({ label, rows: lastRows });
    if (predicate(lastRows)) {
      return lastRows;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${label} did not become true before timeout. Last rows: ${JSON.stringify(lastRows)}`);
}

function findRow(rows: readonly ClickSwitcherRow[], threadId: string): ClickSwitcherRow | undefined {
  return rows.find((row) => row.threadId === threadId);
}

function filterScenarioRows(rows: readonly ClickSwitcherRow[], ...threadIds: string[]): ClickSwitcherRow[] {
  const allowedThreadIds = new Set(threadIds);
  return rows.filter((row) => allowedThreadIds.has(row.threadId));
}
