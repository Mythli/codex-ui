import { expect, type Page, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { ClickAppPage } from "./support/ClickAppPage";

const liveResponseTimeoutMs = 120_000;
const attachmentEchoText = "codex-click-e2e-file-echo-7f4b2c";
const localFileLinkText = "codex-local-file-reference-target";
const localFileBody = "codex-local-file-link-body-918c7f\n";
const tinyPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNk+M9QzwAEjDAGNgkAANkABAXt4RkCAAAAAElFTkSuQmCC";
const duplicateSentinels = {
  alphaReady: "dup-871237812479-alpha-ready",
  attachment: "dup-871237812479-attachment",
  localFileLink: "dup-871237812479-local-file-link"
};

test.describe("live chat activity click e2e", () => {
  test.setTimeout(360_000);

  test("sends live messages and persists attached images after reload", async ({ page }, testInfo) => {
    const app = new ClickAppPage(page, testInfo);

    await app.gotoLiveAppInMessageWorkspace();
    await app.screenshot("01-app-ready");

    await app.selectModelByNameOrId(/codex.*spark|codex-spark/i);
    await app.screenshot("02-codex-spark-selected");

    await app.createNewChat();
    await app.expectCurrentProject();
    await app.screenshot("03-chat-draft-created");

    const alphaReadyPrompt = [
      `Duplicate sentinel: ${duplicateSentinels.alphaReady}`,
      "Reply with exactly this text and no extra words: alpha-ready"
    ].join("\n");
    await app.sendPlainPromptAndExpectUserMessageWithin(alphaReadyPrompt);
    const threadId = await app.currentThreadId(liveResponseTimeoutMs);
    await app.waitForRouteThreadId(threadId, liveResponseTimeoutMs);
    await app.screenshot("04-first-prompt-sent");
    await app.waitForAssistantText("alpha-ready", liveResponseTimeoutMs);
    await app.expectUserMessageSentinelOnce(duplicateSentinels.alphaReady);
    await app.screenshot("05-first-answer");
    await app.expectCurrentChatReloadsToSameTranscriptState({ label: "live-chat-alpha-ready" });

    const textAttachmentPath = testInfo.outputPath("click-e2e-echo.txt");
    const imageAttachmentPath = testInfo.outputPath("click-e2e-image.png");
    const imageOnlyAttachmentPath = testInfo.outputPath("click-e2e-image-only.png");
    await writeFile(textAttachmentPath, `${attachmentEchoText}\n`);
    await writeFile(imageAttachmentPath, Buffer.from(tinyPngBase64, "base64"));
    await writeFile(imageOnlyAttachmentPath, Buffer.from(tinyPngBase64, "base64"));
    await app.sendPromptWithFiles([
      `Duplicate sentinel: ${duplicateSentinels.attachment}`,
      "Use cat on the attached text file and reply with exactly its contents and no extra words.",
      "The attached image is only for UI rendering coverage."
    ].join("\n"), [textAttachmentPath, imageAttachmentPath]);
    await app.waitForAssistantText(attachmentEchoText);
    await app.expectUserMessageSentinelOnce(duplicateSentinels.attachment);
    await app.waitForRenderedTranscriptImage();
    await app.screenshot("06-attachment-image-rendered");
    await app.expectCurrentChatReloadsToSameTranscriptState({ label: "live-chat-attachment" });

    const localFilePath = testInfo.outputPath("click-e2e-local-file-link.txt");
    await writeFile(localFilePath, localFileBody);
    await app.sendPromptAndExpectTurnWithin([
      `Duplicate sentinel: ${duplicateSentinels.localFileLink}`,
      `Reply with exactly this Markdown link and no extra words: [${localFileLinkText}](${pathToFileURL(localFilePath).href})`
    ].join("\n"), {
      expectedUserMessageText: duplicateSentinels.localFileLink,
      matchMode: "contains"
    });
    await app.waitForAssistantText(localFileLinkText, liveResponseTimeoutMs);
    await app.expectUserMessageSentinelOnce(duplicateSentinels.localFileLink);
    await expectAssistantLocalFileLinkWorks(page, {
      expectedBody: localFileBody,
      linkText: localFileLinkText,
      rawPath: localFilePath
    });
    await app.screenshot("07-local-file-link-rendered");
    await app.expectCurrentChatReloadsToSameTranscriptState({ label: "live-chat-local-file-link" });

    await app.sendFilesOnly([imageOnlyAttachmentPath]);
    await app.waitForRenderedTranscriptImage(30_000, 2);
    await app.screenshot("08-image-only-message-rendered");

    await page.reload();
    await app.waitForRouteThreadId(threadId, liveResponseTimeoutMs);
    await app.expectHydratedWorkspace(threadId);
    await app.waitForAssistantText(attachmentEchoText);
    await app.expectUserMessageSentinelOnce(duplicateSentinels.attachment);
    await app.waitForAssistantText(localFileLinkText, liveResponseTimeoutMs);
    await app.expectUserMessageSentinelOnce(duplicateSentinels.localFileLink);
    await expectAssistantLocalFileLinkWorks(page, {
      expectedBody: localFileBody,
      linkText: localFileLinkText,
      rawPath: localFilePath
    });
    await app.waitForRenderedTranscriptImage(30_000, 2);
    await app.screenshot("09-attachment-images-and-file-link-rendered-after-reload");
    await app.expectNoAppError();
  });
});

async function expectAssistantLocalFileLinkWorks(
  page: Page,
  input: {
    expectedBody: string;
    linkText: string;
    rawPath: string;
  }
): Promise<void> {
  const link = page.getByTestId("transcript-assistant-message").getByRole("link", { name: input.linkText });
  await expect(link).toHaveCount(1, { timeout: 30_000 });
  const href = await link.getAttribute("href");
  if (!href) {
    throw new Error(`Expected ${input.linkText} link to have an href.`);
  }
  expect(href).toContain("/codex-assets/file-");
  expect(href).not.toContain(input.rawPath);
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await expect(link).toHaveAttribute("target", "_blank");

  const response = await page.evaluate(async (assetHref) => {
    const result = await fetch(assetHref);
    return {
      ok: result.ok,
      status: result.status,
      text: await result.text()
    };
  }, href);
  expect(response).toEqual({
    ok: true,
    status: 200,
    text: input.expectedBody
  });
}
