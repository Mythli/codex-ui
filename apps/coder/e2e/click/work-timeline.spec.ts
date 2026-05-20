import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, rm } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import { ClickAppPage } from "./support/ClickAppPage";

const liveResponseTimeoutMs = 180_000;

test.describe("work timeline click e2e", () => {
  test.setTimeout(360_000);

  test("streams grouped command work and keeps it expandable after completion", async ({ page }, testInfo) => {
    const app = new ClickAppPage(page, testInfo);
    const sentinel = `work-timeline-${Date.now().toString(36)}`;
    const finalText = `work-timeline-final-${sentinel}`;

    await page.setViewportSize({ width: 1600, height: 1200 });
    await app.gotoLiveApp();
    await app.screenshot("01-app-ready");

    await app.selectModelByNameOrId(/codex.*spark|codex-spark/i);
    await app.createNewChat();
    await app.screenshot("02-draft-chat");

    await app.sendPromptAndExpectTurnWithin([
      `Click e2e work timeline sentinel: ${sentinel}`,
      "",
      "This is a UI test. Please do exactly this:",
      `1. First send this short progress sentence: I will run three separate commands for ${sentinel}.`,
      "2. Use exactly three separate shell command tool calls, in this exact order, no combined shell command, no loops, and no other tool calls:",
      `   - printf '${sentinel}-alpha\\n'`,
      `   - printf '${sentinel}-omega\\n'`,
      "   - sleep 8",
      "3. Do not edit files.",
      `4. After all three commands finish, reply exactly: ${finalText}`
    ].join("\n"), {
      expectedUserMessageText: sentinel,
      matchMode: "contains",
      timeoutMs: 30_000
    });

    const runningWorkBlock = page.getByTestId("transcript-work-block").last();
    await expect(runningWorkBlock).toHaveAttribute("data-row-state", "working", { timeout: 30_000 });
    await expect(runningWorkBlock.getByTestId("work-block-toggle")).toHaveAttribute("aria-label", /^Working for (?:a moment|\d+s)$/);
    const runningBlockId = await requiredAttribute(runningWorkBlock, "data-block-id");
    await app.screenshot("03-work-block-running");

    await ensureExpanded(runningWorkBlock.getByTestId("work-block-toggle"));
    const runningCommandSummary = runningWorkBlock.getByTestId("work-entry-activity-summary").filter({ hasText: "Running 3 commands" }).last();
    await expect(runningCommandSummary).toBeVisible({ timeout: 120_000 });
    await expect(runningWorkBlock).toHaveAttribute("data-row-state", "working");
    await expect(runningCommandSummary).toHaveAttribute("data-work-entry-title", "Running 3 commands");
    await expect(runningCommandSummary).toHaveAttribute("data-work-entry-call-count", "3");
    const runningSummaryButton = runningCommandSummary.getByRole("button", { name: "Running 3 commands" });
    await expectCollapsed(runningSummaryButton);
    await expect(runningCommandSummary.locator('[data-testid="work-entry"][data-work-entry-type="command"]')).toHaveCount(0);
    await app.screenshot("04-running-summary-collapsed");

    await ensureExpanded(runningSummaryButton);
    const runningCommandRows = runningCommandSummary.locator('[data-testid="work-entry"][data-work-entry-type="command"]');
    await expect(runningCommandRows).toHaveCount(3, { timeout: 10_000 });
    await expect(runningCommandRows.getByTestId("command-details")).toHaveCount(0);
    const runningCommands = await commandValues(runningCommandRows);
    const [runningAlphaCommand = "", runningOmegaCommand = "", runningSleepCommand = ""] = runningCommands;
    expect(runningAlphaCommand).toContain(`${sentinel}-alpha`);
    expect(runningOmegaCommand).toContain(`${sentinel}-omega`);
    expect(runningSleepCommand).toContain("sleep 8");
    await expect(runningCommandRows.nth(0)).toContainText(`${sentinel}-alpha`);
    await expect(runningCommandRows.nth(1)).toContainText(`${sentinel}-omega`);
    await expect(runningCommandRows.nth(2)).toContainText("sleep 8");
    await expectCommandRowsCollapsed(runningCommandRows);
    await app.screenshot("05-running-summary-expanded");

    await app.waitForAssistantText(finalText, liveResponseTimeoutMs);

    let completedWorkBlock = page.getByTestId("transcript-work-block").last();
    await expect(completedWorkBlock).toHaveAttribute("data-block-id", runningBlockId);
    await expect(completedWorkBlock).toHaveAttribute("data-row-state", "done", { timeout: 30_000 });
    await expect(completedWorkBlock.getByTestId("work-block-toggle")).toHaveAttribute("aria-label", /^Worked for (?:a moment|\d+s)$/);
    await expectCollapsed(completedWorkBlock.getByTestId("work-block-toggle"));
    await expect(completedWorkBlock.getByTestId("work-entry-list")).toHaveCount(0);
    await app.screenshot("06-completed-collapsed-live");

    await app.expectCurrentChatReloadsToSameTranscriptState({ label: "work-timeline-completed" });
    completedWorkBlock = page.getByTestId("transcript-work-block").last();
    await expect(completedWorkBlock).toHaveAttribute("data-row-state", "done", { timeout: 30_000 });
    await app.screenshot("07-completed-collapsed-reloaded");

    await ensureExpanded(completedWorkBlock.getByTestId("work-block-toggle"));
    await expect(completedWorkBlock.getByRole("group", { name: "Work timeline entries" })).toBeVisible();

    const commandSummary = completedWorkBlock.getByTestId("work-entry-activity-summary").filter({ hasText: "Ran 3 commands" }).last();
    await expect(commandSummary).toBeVisible({ timeout: 30_000 });
    await expect(commandSummary).toHaveAttribute("data-work-entry-title", "Ran 3 commands");
    await expect(commandSummary).toHaveAttribute("data-work-entry-call-count", "3");

    const summaryButton = commandSummary.getByRole("button", { name: "Ran 3 commands" });
    await expectCollapsed(summaryButton);
    await ensureExpanded(summaryButton);

    const commandRows = commandSummary.locator('[data-testid="work-entry"][data-work-entry-type="command"]');
    await expect(commandRows).toHaveCount(3, { timeout: 10_000 });
    await expect(commandRows.getByTestId("command-details")).toHaveCount(0);
    const commands = await commandValues(commandRows);
    const [alphaCommand = "", omegaCommand = "", sleepCommand = ""] = commands;
    expect(commands).toEqual(runningCommands);
    expect(alphaCommand).toContain(`${sentinel}-alpha`);
    expect(omegaCommand).toContain(`${sentinel}-omega`);
    expect(sleepCommand).toContain("sleep 8");
    await expect(commandRows.nth(0)).toContainText(`${sentinel}-alpha`);
    await expect(commandRows.nth(1)).toContainText(`${sentinel}-omega`);
    await expect(commandRows.nth(2)).toContainText("sleep 8");
    await expectCommandRowsCollapsed(commandRows);
    await commandSummary.scrollIntoViewIfNeeded();
    await app.screenshot("08-completed-summary-expanded");

    const firstCommandTitle = await requiredAttribute(commandRows.nth(0), "data-work-entry-title");
    const firstCommandButton = commandRows.nth(0).getByRole("button", { name: firstCommandTitle });
    await ensureExpanded(firstCommandButton);
    const firstCommandDetails = commandRows.nth(0).getByTestId("command-details");
    await expect(firstCommandDetails).toBeVisible();
    await expect(firstCommandDetails).toContainText(`${sentinel}-alpha`);
    await expect(firstCommandDetails).toHaveAttribute("aria-label", /Command details for /);

    await app.screenshot("09-command-details-expanded");
    await app.expectNoAppError();
  });

  test("completes file work without leaving an in-progress file loader", async ({ page }, testInfo) => {
    const app = new ClickAppPage(page, testInfo);
    const sentinel = `file-work-${Date.now().toString(36)}`;
    const fileDir = "apps/coder/e2e/generated-work-timeline";
    const fileName = `${sentinel}-falling-banana-poem.txt`;
    const filePath = `${fileDir}/${fileName}`;
    const repoRoot = resolvePath(process.cwd(), "../..");
    const absoluteFileDir = resolvePath(repoRoot, fileDir);
    const absoluteFilePath = resolvePath(repoRoot, filePath);
    const finalText = `file-work-final-${sentinel}`;

    await mkdir(absoluteFileDir, { recursive: true });
    await rm(absoluteFilePath, { force: true });

    try {
      await page.setViewportSize({ width: 1600, height: 1200 });
      await app.gotoLiveApp();
      await app.selectModelByNameOrId(/codex.*spark|codex-spark/i);
      await app.createNewChat();
      await selectFullAccess(page);
      await app.screenshot("08-file-draft-chat");

      await app.sendPromptAndExpectTurnWithin([
        `Click e2e file timeline sentinel: ${sentinel}`,
        "",
        "This is a UI test. Please do exactly this:",
        `1. First send this short progress sentence: I will create ${fileName}.`,
        `2. Create exactly one file at ${filePath} with exactly these four lines:`,
        `   ${sentinel}`,
        "   falling banana",
        "   lands softly",
        "   end",
        "3. Do not use shell commands for the file creation; use the workspace file editing mechanism.",
        "4. Do not create or modify any other files.",
        `5. After the file is written, reply exactly: ${finalText}`
      ].join("\n"), {
        expectedUserMessageText: sentinel,
        matchMode: "contains",
        timeoutMs: 30_000
      });

      const transcript = page.getByTestId("chat-transcript");
      const runningWorkBlock = transcript.getByTestId("transcript-work-block").last();
      await expect(runningWorkBlock).toHaveAttribute("data-row-state", "working", { timeout: 30_000 });
      await expect(runningWorkBlock.getByTestId("work-block-toggle")).toHaveAttribute("aria-label", /^Working for (?:a moment|\d+s)$/);
      await app.screenshot("09-file-work-running");

      await app.waitForAssistantText(finalText, liveResponseTimeoutMs);

      const completedWorkBlock = transcript.getByTestId("transcript-work-block").last();
      await expect(completedWorkBlock).toHaveAttribute("data-row-state", "done", { timeout: 30_000 });
      await expect(completedWorkBlock.getByTestId("work-block-toggle")).toHaveAttribute("aria-label", /^Worked for (?:a moment|\d+s)$/);
      await expect(transcript.locator('[data-work-entry-state="inProgress"], [data-work-entry-state="running"]')).toHaveCount(0, { timeout: 30_000 });
      await expect(transcript.getByTestId("file-change-progress")).toHaveCount(0, { timeout: 30_000 });

      const fileCards = transcript.getByTestId("file-change-card");
      await expect(fileCards).toHaveCount(1, { timeout: 30_000 });
      const fileCard = fileCards.first();
      await expect(fileCard).toBeVisible();
      await expect(fileCard).toContainText(fileName);
      await expect(fileCard.getByLabel("Changed lines: +4 -0")).toHaveCount(2);
      await expect(fileCard).toContainText("Review");
      await expect(fileCard).not.toContainText("Creating");
      await app.screenshot("10-file-work-completed-card");
      await app.expectCurrentChatReloadsToSameTranscriptState({ label: "file-work-completed" });
      await app.expectNoAppError();
    } finally {
      await rm(absoluteFilePath, { force: true });
    }
  });
});

async function expectCollapsed(button: Locator): Promise<void> {
  await expect(button).toHaveAttribute("aria-expanded", "false", { timeout: 5_000 });
}

async function ensureExpanded(button: Locator): Promise<void> {
  if (await button.getAttribute("aria-expanded") !== "true") {
    await button.click();
  }
  await expect(button).toHaveAttribute("aria-expanded", "true", { timeout: 5_000 });
}

async function requiredAttribute(locator: Locator, name: string): Promise<string> {
  const value = await locator.getAttribute(name);
  expect(value, `${name} should be present`).toBeTruthy();
  return value ?? "";
}

async function commandValues(rows: Locator): Promise<string[]> {
  return rows.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-command") ?? ""));
}

async function expectCommandRowsCollapsed(rows: Locator): Promise<void> {
  const count = await rows.count();
  for (let index = 0; index < count; index += 1) {
    await expectCollapsed(rows.nth(index).getByRole("button"));
  }
}

async function selectFullAccess(page: Page): Promise<void> {
  const accessModeButton = page.getByTestId("access-mode-button");
  await expect(accessModeButton).toBeVisible({ timeout: 10_000 });
  if ((await accessModeButton.getAttribute("aria-label"))?.includes("Full access")) {
    return;
  }

  await accessModeButton.click();
  const permissionPopover = page.getByTestId("permission-popover");
  await expect(permissionPopover).toBeVisible({ timeout: 5_000 });
  await permissionPopover.getByTestId("permission-option-full-access").click();
  await expect(accessModeButton).toHaveAttribute("aria-label", /Full access/, { timeout: 5_000 });
}
