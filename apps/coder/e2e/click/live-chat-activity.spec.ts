import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { ClickAppPage, type ClickSwitcherRow } from "./support/ClickAppPage";

const liveResponseTimeoutMs = 120_000;
const attachmentEchoText = "codex-click-e2e-file-echo-7f4b2c";
const tinyPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNk+M9QzwAEjDAGNgkAANkABAXt4RkCAAAAAElFTkSuQmCC";
const duplicateSentinels = {
  alphaReady: "dup-871237812479-alpha-ready",
  alphaSleep: "dup-871237812479-alpha-sleep",
  betaReady: "dup-871237812479-beta-ready",
  alphaAgain: "dup-871237812479-alpha-again",
  attachment: "dup-871237812479-attachment"
};

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

      const alphaReadyPrompt = [
        `Duplicate sentinel: ${duplicateSentinels.alphaReady}`,
        "Reply with exactly this text and no extra words: alpha-ready"
      ].join("\n");
      await app.sendPlainPromptAndExpectUserMessageWithin(alphaReadyPrompt);
      const chatA = await app.currentThreadId(liveResponseTimeoutMs);
      await app.waitForRouteThreadId(chatA, liveResponseTimeoutMs);
      await app.screenshot("04-chat-a-first-prompt-sent");
      await app.waitForAssistantText("alpha-ready", liveResponseTimeoutMs);
      await app.expectUserMessageSentinelOnce(duplicateSentinels.alphaReady);
      await app.screenshot("05-chat-a-first-answer");

      await page.waitForTimeout(500);
      const alphaSleepPrompt = [
        `Duplicate sentinel: ${duplicateSentinels.alphaSleep}`,
        "Run these two shell commands in order:",
        "sleep 5",
        "sleep 5",
        "After both commands complete, reply with exactly this text and no extra words: alpha-slept"
      ].join("\n");
      await app.sendPlainPromptAndExpectUserMessageWithin(alphaSleepPrompt);
      await app.screenshot("06-chat-a-sleep-prompt-sent");

      await app.openSwitcher();
      const aRunningRows = await expectRows("chat A running after sleep prompt", app, snapshots, (rows) => {
        const scenarioRows = filterScenarioRows(rows, chatA);
        const row = findRow(scenarioRows, chatA);
        expect(row?.isRunning).toBe(true);
      });
      await app.screenshot("07-chat-a-running-in-switcher");
      await app.closeSwitcher();
      expect(findRow(aRunningRows, chatA)?.isRunning).toBe(true);

      await app.createNewChat();
      await app.screenshot("08-chat-b-draft-created");
      const betaReadyPrompt = [
        `Duplicate sentinel: ${duplicateSentinels.betaReady}`,
        "Reply with exactly this text and no extra words: beta-ready"
      ].join("\n");
      await app.sendPlainPromptAndExpectUserMessageWithin(betaReadyPrompt);
      const chatB = await app.currentThreadId(liveResponseTimeoutMs, chatA);
      await app.waitForRouteThreadId(chatB, liveResponseTimeoutMs);
      await app.screenshot("09-chat-b-first-prompt-sent");

      await app.openSwitcher();
      await expectRows("chat B first and chat A background state visible", app, snapshots, (rows) => {
        const scenarioRows = filterScenarioRows(rows, chatA, chatB);
        expect(scenarioRows[0]?.threadId).toBe(chatB);
        const chatARow = findRow(scenarioRows, chatA);
        expect(Boolean(chatARow?.isRunning || chatARow?.isUnread)).toBe(true);
      });
      await app.screenshot("10-chat-b-first-chat-a-running");
      await app.closeSwitcher();

      await app.openSwitcher();
      await expectRowsEventually("chat A background state remains visible", app, snapshots, (rows) => {
        const scenarioRows = filterScenarioRows(rows, chatA, chatB);
        const chatARow = findRow(scenarioRows, chatA);
        return Boolean(chatARow?.isUnread || chatARow?.isRunning);
      }, 90_000);
      await app.screenshot("11-chat-a-unread-background-answer");
      await app.closeSwitcher();

      await app.waitForAssistantText("beta-ready");
      await app.expectUserMessageSentinelOnce(duplicateSentinels.betaReady);
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
      await app.expectUserMessageSentinelOnce(duplicateSentinels.alphaReady);
      await app.expectUserMessageSentinelOnce(duplicateSentinels.alphaSleep);
      await app.screenshot("14-chat-a-sleep-answer-visible");

      await app.openSwitcher();
      await expectRows("chat A unread cleared", app, snapshots, (rows) => {
        const scenarioRows = filterScenarioRows(rows, chatA, chatB);
        const chatARow = findRow(scenarioRows, chatA);
        expect(chatARow?.isUnread).toBe(false);
      });
      await app.closeSwitcher();

      const alphaAgainPrompt = [
        `Duplicate sentinel: ${duplicateSentinels.alphaAgain}`,
        "Reply with exactly this text and no extra words: alpha-again"
      ].join("\n");
      await app.sendPlainPromptAndExpectUserMessageWithin(alphaAgainPrompt);
      await app.screenshot("15-chat-a-third-prompt-sent");

      await app.openSwitcher();
      await expectRowsEventually("chat A first after third prompt", app, snapshots, (rows) =>
        filterScenarioRows(rows, chatA, chatB)[0]?.threadId === chatA,
      10_000);
      await app.screenshot("16-chat-a-first-again-running");
      await app.closeSwitcher();

      await app.waitForAssistantText("alpha-again");
      await app.expectUserMessageSentinelOnce(duplicateSentinels.alphaAgain);
      await app.screenshot("17-chat-a-third-answer");

      const textAttachmentPath = testInfo.outputPath("click-e2e-echo.txt");
      const imageAttachmentPath = testInfo.outputPath("click-e2e-image.png");
      await writeFile(textAttachmentPath, `${attachmentEchoText}\n`);
      await writeFile(imageAttachmentPath, Buffer.from(tinyPngBase64, "base64"));
      await app.sendPromptWithFiles([
        `Duplicate sentinel: ${duplicateSentinels.attachment}`,
        "Use cat on the attached text file and reply with exactly its contents and no extra words.",
        "The attached image is only for UI rendering coverage."
      ].join("\n"), [textAttachmentPath, imageAttachmentPath]);
      await app.waitForAssistantText(attachmentEchoText);
      await app.expectUserMessageSentinelOnce(duplicateSentinels.attachment);
      await app.waitForRenderedTranscriptImage();
      await app.screenshot("18-attachment-echo-image-rendered");
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
