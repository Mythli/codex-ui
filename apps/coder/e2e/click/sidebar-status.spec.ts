import { expect, test } from "@playwright/test";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { ClickAppPage } from "./support/ClickAppPage";

const clickDir = dirname(fileURLToPath(import.meta.url));
const sidebarStatusWorkspaceCwd = process.env.CODER_E2E_SIDEBAR_STATUS_WORKSPACE_CWD
  ? resolvePath(process.env.CODER_E2E_SIDEBAR_STATUS_WORKSPACE_CWD)
  : resolvePath(clickDir, "../../test-results/click-sidebar-status-workspace");
const liveResponseTimeoutMs = 180_000;

test.describe("sidebar status click e2e", () => {
  test.setTimeout(360_000);

  test("shows running and unread status for a background sleep turn", async ({ page }, testInfo) => {
    const app = new ClickAppPage(page, testInfo);
    const sentinel = `sidebar-status-${Date.now().toString(36)}`;
    const otherSentinel = `${sentinel}-other`;
    const otherFinalText = `${otherSentinel}-ready`;
    const sleepPrompt = "run sleep for 10s";

    await page.setViewportSize({ width: 1600, height: 1200 });
    await app.gotoLiveAppInMessageWorkspace(sidebarStatusWorkspaceCwd);
    await app.screenshot("01-app-ready");

    await app.selectModelByNameOrId(/codex.*spark|codex-spark/i);

    await app.createNewChat();
    await app.expectCurrentProject(sidebarStatusWorkspaceCwd);
    await app.sendPromptAndExpectTurnWithin([
      `Click e2e sidebar status other thread sentinel: ${otherSentinel}`,
      "",
      "This is a UI test. Do not edit files.",
      `Reply exactly: ${otherFinalText}`
    ].join("\n"), {
      expectedUserMessageText: otherSentinel,
      matchMode: "contains",
      timeoutMs: 30_000
    });
    const otherThreadId = await app.currentThreadId(liveResponseTimeoutMs);
    await app.waitForAssistantText(otherFinalText, liveResponseTimeoutMs);
    await app.screenshot("02-other-thread-ready");
    await app.expectCurrentChatReloadsToSameTranscriptState({ label: "sidebar-other-thread-ready" });

    await app.createNewChat();
    await app.expectCurrentProject(sidebarStatusWorkspaceCwd);
    await app.sendPrompt(sleepPrompt);
    const sleepThreadId = await app.currentThreadId(liveResponseTimeoutMs);
    expect(sleepThreadId).not.toBe(otherThreadId);
    await app.screenshot("03-sleep-thread-sent-before-switch");

    await app.openChatById(otherThreadId);
    await app.expectReadyThread(otherThreadId);
    await app.expectSwitcherThreadRunning(sleepThreadId, 30_000);
    await app.screenshot("04-sleep-thread-running-in-switcher");

    await app.expectSwitcherThreadUnread(sleepThreadId, liveResponseTimeoutMs);
    await app.screenshot("05-sleep-thread-unread");

    await app.openChatById(sleepThreadId);
    await app.expectReadyThread(sleepThreadId);
    await app.expectUserMessageTextCount(sleepPrompt);
    await app.expectSwitcherThreadNotUnread(sleepThreadId);
    await app.screenshot("06-sleep-thread-unread-cleared");

    await app.openChatById(otherThreadId);
    await app.expectReadyThread(otherThreadId);
    await app.expectSwitcherThreadNotUnread(sleepThreadId);
    await app.screenshot("07-sleep-thread-still-read-after-switch-away");
    await app.expectNoAppError();
  });
});
