import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { io } from "socket.io-client";

const supportDir = dirname(fileURLToPath(import.meta.url));
const defaultMessageWorkspaceCwd = resolvePath(supportDir, "../../../test-results/click-message-workspace");

export const CLICK_MESSAGE_WORKSPACE_CWD = process.env.CODER_E2E_MESSAGE_WORKSPACE_CWD
  ? resolvePath(process.env.CODER_E2E_MESSAGE_WORKSPACE_CWD)
  : defaultMessageWorkspaceCwd;

export type ClickThread = {
  projectId?: string;
  title?: string;
  threadId: string;
};

export type ClickSwitcherRow = ClickThread & {
  index: number;
  isRunning: boolean;
  isUnread: boolean;
};

type PromptTurnVisibilityResult = {
  ok: boolean;
  elapsedMs?: number;
  userMessageElapsedMs?: number;
  workBlockElapsedMs?: number;
  reason?: string;
  location: string;
  currentChatId?: string;
  matchMode: "exact" | "contains";
  promptValue: string;
  targetText: string;
  timeoutMs: number;
  userMessageTimeoutMs: number;
  transcriptText: string;
  userMessageTexts: string[];
  workBlockTexts: string[];
};

type TranscriptStateSignature = {
  rows: TranscriptRowSignature[];
  rowCount: number;
  text: string;
};

type TranscriptRowSignature = {
  ariaLabel: string | null;
  controls: Array<{
    disabled: boolean;
    expanded: string | null;
    label: string | null;
    testId: string | null;
    text: string;
  }>;
  fileCards: Array<{
    label: string | null;
    files: Array<{
      open: boolean;
      stats: string[];
      text: string;
    }>;
    stats: string[];
    text: string;
  }>;
  images: Array<{
    alt: string | null;
    testId: string | null;
  }>;
  index: number;
  links: Array<{
    href: string | null;
    text: string;
  }>;
  role: string | null;
  rowFinal: string | null;
  rowState: string | null;
  rowType: string | null;
  testId: string | null;
  text: string;
  workEntries: Array<{
    callCount: string | null;
    command: string | null;
    expanded: string | null;
    hasDetails: string | null;
    state: string | null;
    testId: string | null;
    title: string | null;
    type: string | null;
  }>;
  workEntryCount: string | null;
};

export class ClickAppPage {
  private draftPreviousThreadId?: string;

  constructor(
    private readonly page: Page,
    private readonly testInfo?: TestInfo
  ) {}

  async gotoLiveApp(): Promise<void> {
    await this.page.goto("/");
    await this.waitForLiveAppReady();
  }

  async gotoLiveAppInMessageWorkspace(cwd = CLICK_MESSAGE_WORKSPACE_CWD): Promise<void> {
    const seedThread = await this.ensureWorkspaceThread(cwd);
    await this.page.goto(`/chats/${seedThread.threadId}`);
    await this.waitForLiveAppReady();
    await this.expectCurrentProject(cwd);
  }

  async expectCurrentProject(projectId = CLICK_MESSAGE_WORKSPACE_CWD): Promise<void> {
    await expect(this.page.getByTestId("coder-shell"))
      .toHaveAttribute("data-current-project-id", projectId, { timeout: 20_000 });
  }

  private async waitForLiveAppReady(): Promise<void> {
    await this.page.getByTestId("coder-shell").waitFor({ timeout: 20_000 });
    await this.page.getByRole("button", { name: "Open sidebar" }).waitFor({ timeout: 20_000 });
    await this.expectNoAppError();
    await this.expectBackendModelListReady();
  }

  async latestBackendThreads(limit: number, options: { cwd?: string | null } = {}): Promise<ClickThread[]> {
    const response = await this.requestCodex("thread/list", {
      limit,
      sortKey: "updated_at",
      sortDirection: "desc",
      sourceKinds: [],
      archived: false,
      cwd: options.cwd ?? null
    });
    const data = response && typeof response === "object" && "data" in response
      ? (response as { data?: unknown }).data
      : undefined;
    return Array.isArray(data)
      ? data.flatMap((thread) => thread && typeof thread === "object" && "id" in thread && typeof thread.id === "string"
        ? [{
          projectId: "cwd" in thread && typeof thread.cwd === "string" ? thread.cwd : undefined,
          title: "title" in thread && typeof thread.title === "string" ? thread.title : undefined,
          threadId: thread.id
        }]
        : [])
      : [];
  }

  private async ensureWorkspaceThread(cwd: string): Promise<ClickThread> {
    await mkdir(cwd, { recursive: true });

    const existingThread = (await this.latestBackendThreads(20, { cwd }))
      .find((thread) => thread.projectId === cwd);
    if (existingThread) {
      return existingThread;
    }

    const response = await this.requestCodex("thread/start", {
      cwd,
      model: null,
      modelProvider: null,
      approvalPolicy: "never",
      sandbox: "workspace-write",
      ephemeral: false,
      persistExtendedHistory: true
    });
    const thread = response && typeof response === "object" && "thread" in response
      ? (response as { thread?: unknown }).thread
      : undefined;
    if (!thread || typeof thread !== "object" || !("id" in thread) || typeof thread.id !== "string") {
      throw new Error(`Could not seed click e2e workspace ${cwd}: ${JSON.stringify(response)}`);
    }

    return {
      projectId: cwd,
      threadId: thread.id
    };
  }

  async visibleThreads(limit: number): Promise<ClickThread[]> {
    await this.openSwitcher();
    const threads = (await this.readSwitcherRows({ includeActive: false }))
      .map(({ projectId, threadId, title }) => ({ projectId, threadId, title }));
    await this.closeSwitcher();
    return threads.slice(0, Math.min(Math.max(1, limit), threads.length));
  }

  async selectModelByNameOrId(pattern: RegExp): Promise<void> {
    const popover = this.page.getByTestId("model-popover");
    const deadline = Date.now() + 30_000;
    let observedOptions: Array<{ id: string; label: string }> = [];

    while (Date.now() < deadline) {
      if (!await this.openModelPopover(2_000).catch(() => false)) {
        await this.page.waitForTimeout(500);
        continue;
      }

      observedOptions = await this.readModelOptions();
      const option = observedOptions.findIndex((button) => {
        pattern.lastIndex = 0;
        const idMatches = pattern.test(button.id);
        pattern.lastIndex = 0;
        return idMatches || pattern.test(button.label);
      });
      if (option >= 0) {
        await popover.locator("[data-testid^='model-option-']").nth(option).click();
        await popover.waitFor({ state: "hidden", timeout: 10_000 });
        return;
      }

      await this.page.keyboard.press("Escape");
      await popover.waitFor({ state: "hidden", timeout: 2_000 }).catch(() => undefined);
      await this.page.waitForTimeout(500);
    }

    throw new Error(`Could not find model matching ${pattern}. Observed options: ${JSON.stringify(observedOptions)}`);
  }

  async createNewChat(): Promise<void> {
    await this.clickVisibleNewChatButton();
  }

  async clickVisibleNewChatButton(timeoutMs = 10_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const previousThreadId = await this.selectedThreadId().catch(() => undefined);
      const currentProjectName = await this.page.getByTestId("current-chat-heading")
        .getAttribute("data-project-name")
        .catch(() => undefined);
      await this.page.getByTestId("new-chat-button").click({ timeout: 2_000 });
      const projectOption = currentProjectName
        ? this.page.getByRole("menuitem", { name: currentProjectName }).first()
        : this.page.getByRole("menuitem").first();
      if (await projectOption.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await projectOption.click({ timeout: 2_000 });
      }
      if (await this.isDraftHomeVisible()) {
        this.draftPreviousThreadId = previousThreadId;
        return;
      }
      await this.page.waitForTimeout(100);
    }
    await this.page.getByTestId("chat-home").waitFor({ timeout: 1_000 });
    await expect(this.page.getByTestId("coder-shell")).not.toHaveAttribute("data-current-chat-id", /.+/);
  }

  async sendPrompt(text: string): Promise<void> {
    await this.page.getByTestId("prompt-input").fill(text);
    await expect(this.page.getByTestId("send-prompt-button")).toBeEnabled({ timeout: 10_000 });
    await this.page.getByTestId("send-prompt-button").click();
    await expect(this.page.getByTestId("prompt-input")).toHaveValue("", { timeout: 10_000 });
  }

  async sendPlainPromptAndExpectUserMessageWithin(text: string, timeoutMs = 100): Promise<void> {
    await this.sendPromptAndExpectTurnWithin(text, {
      expectNoComposerAttachmentsBeforeSend: true,
      matchMode: "exact",
      userMessageTimeoutMs: timeoutMs
    });
  }

  async sendPromptAndExpectTurnWithin(
    text: string,
    options: {
      expectedUserMessageText?: string;
      expectNoComposerAttachmentsBeforeSend?: boolean;
      matchMode?: "exact" | "contains";
      timeoutMs?: number;
      userMessageTimeoutMs?: number;
    } = {}
  ): Promise<void> {
    const timeoutMs = options.timeoutMs ?? 10_000;
    const userMessageTimeoutMs = options.userMessageTimeoutMs ?? 100;
    const matchMode = options.matchMode ?? "exact";
    const promptInput = this.page.getByTestId("prompt-input");
    const sendButton = this.page.getByTestId("send-prompt-button");

    if (options.expectNoComposerAttachmentsBeforeSend ?? true) {
      await expect(this.page.getByTestId("composer-attachments")).toHaveCount(0);
    }
    await promptInput.fill(text);
    await expect(sendButton).toBeEnabled({ timeout: 10_000 });

    const watcherId = `prompt-turn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await this.page.evaluate((payload) => {
      const {
        watcherId: turnWatcherId,
        expectedText,
        timeoutMs: waitTimeoutMs,
        matchMode: textMatchMode,
        userMessageTimeoutMs: waitForUserMessageMs
      } = payload;
      const browserWindow = window as typeof window & {
        codexPromptTurnWatchers?: Record<string, Promise<PromptTurnVisibilityResult>>;
      };
      browserWindow.codexPromptTurnWatchers ??= {};

      const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
      const targetText = normalize(expectedText);
      const userMessageSelector = '[data-testid="transcript-user-message"]';
      const activeTurnSelector = [
        '[data-testid="transcript-work-block"][data-row-state="working"]',
        '[data-testid="thinking-placeholder"][data-row-state="working"]'
      ].join(", ");

      const isVisible = (element: Element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== "hidden" &&
          style.display !== "none" &&
          Number(style.opacity) !== 0 &&
          rect.width > 0 &&
          rect.height > 0;
      };

      const visibleTexts = (selector: string) => [...document.querySelectorAll(selector)]
        .filter(isVisible)
        .map((element) => element.textContent?.trim() ?? "");

      const visibleUserMessageTexts = () => visibleTexts(userMessageSelector);
      const visibleWorkBlockTexts = () => visibleTexts(activeTurnSelector);

      const diagnostics = (reason: string, startedAt?: number): PromptTurnVisibilityResult => ({
        ok: false,
        elapsedMs: startedAt === undefined ? undefined : performance.now() - startedAt,
        reason,
        location: window.location.href,
        currentChatId: document.querySelector("[data-testid='coder-shell']")?.getAttribute("data-current-chat-id") ?? undefined,
        matchMode: textMatchMode,
        promptValue: (document.querySelector("[data-testid='prompt-input']") as HTMLTextAreaElement | null)?.value ?? "",
        targetText: expectedText,
        timeoutMs: waitTimeoutMs,
        userMessageTimeoutMs: waitForUserMessageMs,
        transcriptText: document.querySelector("[data-testid='chat-transcript']")?.textContent?.trim() ?? "",
        userMessageTexts: visibleUserMessageTexts(),
        workBlockTexts: visibleWorkBlockTexts()
      });

      browserWindow.codexPromptTurnWatchers[turnWatcherId] = new Promise<PromptTurnVisibilityResult>((resolve) => {
        const button = document.querySelector("[data-testid='send-prompt-button']");
        if (!button) {
          resolve(diagnostics("send button was not found"));
          return;
        }

        let startedAt: number | undefined;
        let userMessageElapsedMs: number | undefined;
        let workBlockElapsedMs: number | undefined;
        let observer: MutationObserver | undefined;
        let timeout: number | undefined;
        let userMessageTimeout: number | undefined;
        let clickTimeout: number | undefined;
        let settled = false;

        const cleanup = () => {
          observer?.disconnect();
          if (timeout !== undefined) {
            window.clearTimeout(timeout);
          }
          if (userMessageTimeout !== undefined) {
            window.clearTimeout(userMessageTimeout);
          }
          if (clickTimeout !== undefined) {
            window.clearTimeout(clickTimeout);
          }
          document.removeEventListener("click", handleClick, { capture: true });
        };

        const finish = (result: PromptTurnVisibilityResult) => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          resolve(result);
        };

        const hasVisibleMatchingUserMessage = () => visibleUserMessageTexts()
          .some((value) => {
            const normalized = normalize(value);
            return textMatchMode === "contains"
              ? normalized.includes(targetText)
              : normalized === targetText;
          });

        const hasVisibleRunningWorkBlock = () => visibleWorkBlockTexts().length > 0;

        const check = () => {
          if (startedAt === undefined) {
            return;
          }
          if (userMessageElapsedMs === undefined && hasVisibleMatchingUserMessage()) {
            userMessageElapsedMs = performance.now() - startedAt;
          }
          if (workBlockElapsedMs === undefined && hasVisibleRunningWorkBlock()) {
            workBlockElapsedMs = performance.now() - startedAt;
          }
          if (userMessageElapsedMs !== undefined && workBlockElapsedMs !== undefined) {
            finish({
              ok: true,
              elapsedMs: Math.max(userMessageElapsedMs, workBlockElapsedMs),
              userMessageElapsedMs,
              workBlockElapsedMs,
              location: window.location.href,
              currentChatId: document.querySelector("[data-testid='coder-shell']")?.getAttribute("data-current-chat-id") ?? undefined,
              matchMode: textMatchMode,
              promptValue: (document.querySelector("[data-testid='prompt-input']") as HTMLTextAreaElement | null)?.value ?? "",
              targetText: expectedText,
              timeoutMs: waitTimeoutMs,
              userMessageTimeoutMs: waitForUserMessageMs,
              transcriptText: document.querySelector("[data-testid='chat-transcript']")?.textContent?.trim() ?? "",
              userMessageTexts: visibleUserMessageTexts(),
              workBlockTexts: visibleWorkBlockTexts()
            });
          }
        };

        const startWatching = () => {
          if (startedAt !== undefined) {
            return;
          }
          startedAt = performance.now();
          observer = new MutationObserver(check);
          observer.observe(document.body, {
            attributes: true,
            attributeFilter: ["data-row-state", "data-testid", "style", "class"],
            characterData: true,
            childList: true,
            subtree: true
          });
          check();
          userMessageTimeout = window.setTimeout(() => {
            check();
            if (userMessageElapsedMs === undefined) {
              finish({
                ...diagnostics("user message was not visible before timeout", startedAt),
                userMessageElapsedMs,
                workBlockElapsedMs
              });
            }
          }, waitForUserMessageMs);
          timeout = window.setTimeout(() => {
            finish({
              ...diagnostics("user message and running work block were not both visible before timeout", startedAt),
              userMessageElapsedMs,
              workBlockElapsedMs
            });
          }, waitTimeoutMs);
        };

        function handleClick(event: MouseEvent) {
          const target = event.target instanceof Element
            ? event.target.closest("[data-testid='send-prompt-button']")
            : null;
          if (target) {
            startWatching();
          }
        }

        document.addEventListener("click", handleClick, { capture: true });
        clickTimeout = window.setTimeout(() => {
          finish(diagnostics("send button click was not observed"));
        }, 10_000);
      });
    }, { watcherId, expectedText: options.expectedUserMessageText ?? text, timeoutMs, matchMode, userMessageTimeoutMs });

    await sendButton.click();
    const result = await this.page.evaluate(async (registeredWatcherId): Promise<PromptTurnVisibilityResult> => {
      const browserWindow = window as typeof window & {
        codexPromptTurnWatchers?: Record<string, Promise<PromptTurnVisibilityResult>>;
      };
      const watcher = browserWindow.codexPromptTurnWatchers?.[registeredWatcherId];
      if (!watcher) {
        throw new Error(`Prompt turn watcher ${registeredWatcherId} was not registered.`);
      }
      try {
        return await watcher;
      } finally {
        delete browserWindow.codexPromptTurnWatchers?.[registeredWatcherId];
      }
    }, watcherId);

    if (!result.ok) {
      throw new Error(`Prompt turn was not visible within ${timeoutMs}ms: ${JSON.stringify(result, null, 2)}`);
    }
    if ((result.userMessageElapsedMs ?? Number.POSITIVE_INFINITY) > userMessageTimeoutMs) {
      throw new Error(`User message became visible after ${result.userMessageElapsedMs}ms, over ${userMessageTimeoutMs}ms: ${JSON.stringify(result, null, 2)}`);
    }
    if ((result.elapsedMs ?? Number.POSITIVE_INFINITY) > timeoutMs) {
      throw new Error(`Prompt turn became visible after ${result.elapsedMs}ms, over ${timeoutMs}ms: ${JSON.stringify(result, null, 2)}`);
    }

    await expect(promptInput).toHaveValue("", { timeout: 10_000 });
  }

  async sendPromptWithFiles(text: string, filePaths: string[]): Promise<void> {
    await this.attachFilesAndExpectPreview(filePaths);
    await this.sendPromptAndExpectTurnWithin(text, {
      expectNoComposerAttachmentsBeforeSend: false,
      matchMode: "contains"
    });
    await expect(this.page.getByTestId("composer-attachments")).toHaveCount(0, { timeout: 10_000 });
  }

  async sendFilesOnly(filePaths: string[]): Promise<void> {
    await this.attachFilesAndExpectPreview(filePaths);
    await expect(this.page.getByTestId("send-prompt-button")).toBeEnabled({ timeout: 10_000 });
    await this.page.getByTestId("send-prompt-button").click();
    await expect(this.page.getByTestId("composer-attachments")).toHaveCount(0, { timeout: 30_000 });
  }

  private async attachFilesAndExpectPreview(filePaths: string[], timeoutMs = 30_000): Promise<void> {
    await this.page.getByTestId("composer-file-input").setInputFiles(filePaths);

    type AttachmentPreviewState = {
      attachmentCount: number;
      errorText?: string;
      inputFileNames: string[];
      trayText?: string;
    };
    let lastState: AttachmentPreviewState | undefined;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      lastState = await this.readAttachmentPreviewState();
      if (lastState.errorText) {
        throw new Error(`Composer attachment upload failed: ${lastState.errorText}`);
      }
      if (lastState.attachmentCount >= filePaths.length) {
        await expect(this.page.getByTestId("composer-attachments").locator("img, [aria-hidden='true']").first())
          .toBeVisible({ timeout: 5_000 });
        return;
      }
      await this.page.waitForTimeout(250);
    }

    throw new Error(`Composer attachment previews did not render within ${timeoutMs}ms: ${JSON.stringify(lastState)}`);
  }

  private async readAttachmentPreviewState(): Promise<{
    attachmentCount: number;
    errorText?: string;
    inputFileNames: string[];
    trayText?: string;
  }> {
    const tray = this.page.getByTestId("composer-attachments");
    const error = this.page.getByTestId("composer-attachment-error");
    const [attachmentCount, errorCount, inputFileNames, trayCount] = await Promise.all([
      tray.getByTestId("composer-attachment").count().catch(() => 0),
      error.count().catch(() => 0),
      this.page.getByTestId("composer-file-input").evaluate((input) => {
        const files = (input as HTMLInputElement).files;
        return files ? [...files].map((file) => file.name) : [];
      }).catch(() => []),
      tray.count().catch(() => 0)
    ]);
    const [errorText, trayText] = await Promise.all([
      errorCount > 0 ? error.first().textContent({ timeout: 0 }).catch(() => undefined) : undefined,
      trayCount > 0 ? tray.first().textContent({ timeout: 0 }).catch(() => undefined) : undefined
    ]);
    return {
      attachmentCount,
      errorText: errorText?.trim() || undefined,
      inputFileNames,
      trayText: trayText?.trim() || undefined
    };
  }

  async waitForAssistantText(textOrPattern: string | RegExp, timeoutMs = 120_000): Promise<void> {
    const transcript = this.page.getByTestId("chat-transcript");
    await expect(transcript).toBeVisible({ timeout: timeoutMs });
    const assistantMessages = this.page.getByTestId("transcript-assistant-message");
    await expect.poll(async () => {
      const messages = await assistantMessages.allTextContents().catch((error: unknown) => {
        if (error instanceof Error && /Execution context was destroyed|navigation/i.test(error.message)) {
          return [];
        }
        throw error;
      });
      return messages.some((message) => {
        if (typeof textOrPattern === "string") {
          return message.includes(textOrPattern);
        }
        textOrPattern.lastIndex = 0;
        return textOrPattern.test(message);
      });
    }, {
      message: `expected an assistant message containing ${String(textOrPattern)}`,
      timeout: timeoutMs
    }).toBe(true);
  }

  async waitForComposerIdle(timeoutMs = 120_000): Promise<void> {
    await expect(this.page.getByTestId("prompt-composer"))
      .not.toHaveAttribute("aria-busy", "true", { timeout: timeoutMs });
  }

  async expectCurrentChatReloadsToSameTranscriptState(options: {
    label?: string;
    timeoutMs?: number;
  } = {}): Promise<void> {
    const label = options.label ?? "current-chat-reload-transcript-state";
    const timeoutMs = options.timeoutMs ?? 30_000;
    const threadId = await this.currentThreadId(timeoutMs);
    const live = await this.currentTranscriptStateSignature();

    await this.page.reload();
    await this.waitForRouteThreadId(threadId, timeoutMs);
    await this.expectHydratedWorkspace(threadId);
    const reloaded = await this.currentTranscriptStateSignature();

    try {
      expect(
        reloaded,
        `${label}: reloaded transcript should match live transcript for ${threadId}`
      ).toEqual(live);
    } catch (error) {
      if (this.testInfo) {
        await this.testInfo.attach(`${label}-live.json`, {
          body: JSON.stringify(live, null, 2),
          contentType: "application/json"
        });
        await this.testInfo.attach(`${label}-reloaded.json`, {
          body: JSON.stringify(reloaded, null, 2),
          contentType: "application/json"
        });
      }
      throw error;
    }
  }

  async expectChatDoesNotShowLoaderFor(label: string, durationMs = 3_000): Promise<void> {
    const result = await this.page.evaluate(async ({ durationMs: waitMs, label: checkLabel }) => {
      const loadingSelector = '[data-testid="chat-loading"][aria-busy="true"]';
      const snapshot = (reason: string) => ({
        ok: false,
        label: checkLabel,
        reason,
        currentChatId: document.querySelector("[data-testid='coder-shell']")?.getAttribute("data-current-chat-id"),
        loadingText: document.querySelector(loadingSelector)?.textContent?.trim(),
        transcriptText: document.querySelector("[data-testid='chat-transcript']")?.textContent?.trim(),
        url: window.location.href
      });

      return await new Promise<{
        currentChatId?: string | null;
        label: string;
        loadingText?: string;
        ok: boolean;
        reason?: string;
        transcriptText?: string;
        url?: string;
      }>((resolve) => {
        const startedAt = performance.now();
        let observer: MutationObserver | undefined;
        let interval: number | undefined;

        const cleanup = () => {
          observer?.disconnect();
          if (interval !== undefined) {
            window.clearInterval(interval);
          }
        };
        const finish = (value: {
          currentChatId?: string | null;
          label: string;
          loadingText?: string;
          ok: boolean;
          reason?: string;
          transcriptText?: string;
          url?: string;
        }) => {
          cleanup();
          resolve(value);
        };
        const check = () => {
          if (document.querySelector(loadingSelector)) {
            finish(snapshot("chat loader became visible"));
            return;
          }
          if (performance.now() - startedAt >= waitMs) {
            finish({
              ok: true,
              label: checkLabel,
              currentChatId: document.querySelector("[data-testid='coder-shell']")?.getAttribute("data-current-chat-id"),
              transcriptText: document.querySelector("[data-testid='chat-transcript']")?.textContent?.trim(),
              url: window.location.href
            });
          }
        };

        observer = new MutationObserver(check);
        observer.observe(document.body, {
          attributes: true,
          attributeFilter: ["aria-busy", "data-testid", "class", "style"],
          childList: true,
          subtree: true
        });
        interval = window.setInterval(check, 50);
        check();
      });
    }, { durationMs, label });

    if (!result.ok) {
      throw new Error(`${label}: chat loader should not appear after the first message is visible: ${JSON.stringify(result, null, 2)}`);
    }
  }

  async expectCurrentChatStaysSelectedFor(threadId: string, label: string, durationMs = 3_000): Promise<void> {
    const result = await this.page.evaluate(async ({ durationMs: waitMs, label: checkLabel, threadId: expectedThreadId }) => {
      const selectedThreadId = () =>
        document.querySelector("[data-testid='coder-shell']")?.getAttribute("data-current-chat-id");
      const snapshot = (reason: string) => ({
        ok: false,
        label: checkLabel,
        reason,
        expectedThreadId,
        selectedThreadId: selectedThreadId(),
        transcriptText: document.querySelector("[data-testid='chat-transcript']")?.textContent?.trim(),
        url: window.location.href
      });

      return await new Promise<{
        expectedThreadId: string;
        label: string;
        ok: boolean;
        reason?: string;
        selectedThreadId?: string | null;
        transcriptText?: string;
        url?: string;
      }>((resolve) => {
        const startedAt = performance.now();
        let observer: MutationObserver | undefined;
        let interval: number | undefined;

        const cleanup = () => {
          observer?.disconnect();
          if (interval !== undefined) {
            window.clearInterval(interval);
          }
        };
        const finish = (value: {
          expectedThreadId: string;
          label: string;
          ok: boolean;
          reason?: string;
          selectedThreadId?: string | null;
          transcriptText?: string;
          url?: string;
        }) => {
          cleanup();
          resolve(value);
        };
        const check = () => {
          if (selectedThreadId() !== expectedThreadId) {
            finish(snapshot("selected chat changed"));
            return;
          }
          if (performance.now() - startedAt >= waitMs) {
            finish({
              ok: true,
              label: checkLabel,
              expectedThreadId,
              selectedThreadId: selectedThreadId(),
              transcriptText: document.querySelector("[data-testid='chat-transcript']")?.textContent?.trim(),
              url: window.location.href
            });
          }
        };

        observer = new MutationObserver(check);
        observer.observe(document.body, {
          attributes: true,
          attributeFilter: ["data-current-chat-id", "data-testid", "class", "style"],
          childList: true,
          subtree: true
        });
        interval = window.setInterval(check, 50);
        check();
      });
    }, { durationMs, label, threadId });

    if (!result.ok) {
      throw new Error(`${label}: selected chat should stay on ${threadId}: ${JSON.stringify(result, null, 2)}`);
    }
  }

  async expectTranscriptStaysScrolledToBottomFor(
    label: string,
    durationMs = 1_000,
    options: { requireScrollable?: boolean; tolerancePx?: number } = {}
  ): Promise<void> {
    const result = await this.page.evaluate(async ({ durationMs: waitMs, label: checkLabel, requireScrollable, tolerancePx }) => {
      const transcriptSelector = '[data-testid="chat-transcript"]';
      const metrics = () => {
        const transcript = document.querySelector(transcriptSelector) as HTMLElement | null;
        if (!transcript) {
          return undefined;
        }
        return {
          clientHeight: transcript.clientHeight,
          deltaFromBottom: transcript.scrollHeight - transcript.clientHeight - transcript.scrollTop,
          scrollHeight: transcript.scrollHeight,
          scrollTop: transcript.scrollTop
        };
      };
      const snapshot = (reason: string) => ({
        ok: false,
        label: checkLabel,
        reason,
        metrics: metrics(),
        transcriptText: document.querySelector(transcriptSelector)?.textContent?.trim(),
        url: window.location.href
      });

      return await new Promise<{
        label: string;
        metrics?: {
          clientHeight: number;
          deltaFromBottom: number;
          scrollHeight: number;
          scrollTop: number;
        };
        ok: boolean;
        reason?: string;
        transcriptText?: string;
        url?: string;
      }>((resolve) => {
        const startedAt = performance.now();
        let observer: MutationObserver | undefined;
        let interval: number | undefined;

        const cleanup = () => {
          observer?.disconnect();
          if (interval !== undefined) {
            window.clearInterval(interval);
          }
        };
        const finish = (value: {
          label: string;
          metrics?: {
            clientHeight: number;
            deltaFromBottom: number;
            scrollHeight: number;
            scrollTop: number;
          };
          ok: boolean;
          reason?: string;
          transcriptText?: string;
          url?: string;
        }) => {
          cleanup();
          resolve(value);
        };
        const check = () => {
          const current = metrics();
          if (!current) {
            finish(snapshot("chat transcript was not found"));
            return;
          }
          if (requireScrollable && current.scrollHeight <= current.clientHeight) {
            finish(snapshot("chat transcript was not scrollable"));
            return;
          }
          if (current.deltaFromBottom > tolerancePx) {
            finish(snapshot("chat transcript was not scrolled to bottom"));
            return;
          }
          if (performance.now() - startedAt >= waitMs) {
            finish({
              ok: true,
              label: checkLabel,
              metrics: current,
              transcriptText: document.querySelector(transcriptSelector)?.textContent?.trim(),
              url: window.location.href
            });
          }
        };

        observer = new MutationObserver(check);
        observer.observe(document.body, {
          attributes: true,
          attributeFilter: ["class", "data-testid", "style"],
          characterData: true,
          childList: true,
          subtree: true
        });
        interval = window.setInterval(check, 50);
        check();
      });
    }, {
      durationMs,
      label,
      requireScrollable: options.requireScrollable ?? false,
      tolerancePx: options.tolerancePx ?? 2
    });

    if (!result.ok) {
      throw new Error(`${label}: transcript should stay scrolled to bottom: ${JSON.stringify(result, null, 2)}`);
    }
  }

  async waitForTranscriptScrollable(timeoutMs = 10_000): Promise<void> {
    await expect.poll(async () => this.page.getByTestId("chat-transcript").evaluate((transcript) => {
      const element = transcript as HTMLElement;
      return {
        clientHeight: element.clientHeight,
        isScrollable: element.scrollHeight > element.clientHeight,
        scrollHeight: element.scrollHeight
      };
    }), {
      message: "expected chat transcript to become scrollable",
      timeout: timeoutMs
    }).toMatchObject({ isScrollable: true });
  }

  async scrollTranscriptToBottom(): Promise<void> {
    await this.page.getByTestId("chat-transcript").evaluate((transcript) => {
      const element = transcript as HTMLElement;
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
  }

  async scrollTranscriptUp(distancePx = 600): Promise<void> {
    await this.waitForTranscriptScrollable();
    await this.page.getByTestId("chat-transcript").evaluate((transcript, distance) => {
      const element = transcript as HTMLElement;
      element.scrollTop = Math.max(0, element.scrollTop - distance);
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    }, distancePx);
  }

  async expectTranscriptStaysAwayFromBottomFor(
    label: string,
    durationMs = 1_000,
    options: { minDistancePx?: number; requireScrollable?: boolean } = {}
  ): Promise<void> {
    const result = await this.page.evaluate(async ({ durationMs: waitMs, label: checkLabel, minDistancePx, requireScrollable }) => {
      const transcriptSelector = '[data-testid="chat-transcript"]';
      const metrics = () => {
        const transcript = document.querySelector(transcriptSelector) as HTMLElement | null;
        if (!transcript) {
          return undefined;
        }
        return {
          clientHeight: transcript.clientHeight,
          deltaFromBottom: transcript.scrollHeight - transcript.clientHeight - transcript.scrollTop,
          scrollHeight: transcript.scrollHeight,
          scrollTop: transcript.scrollTop
        };
      };
      const snapshot = (reason: string) => ({
        ok: false,
        label: checkLabel,
        reason,
        metrics: metrics(),
        transcriptText: document.querySelector(transcriptSelector)?.textContent?.trim(),
        url: window.location.href
      });

      return await new Promise<{
        label: string;
        metrics?: {
          clientHeight: number;
          deltaFromBottom: number;
          scrollHeight: number;
          scrollTop: number;
        };
        ok: boolean;
        reason?: string;
        transcriptText?: string;
        url?: string;
      }>((resolve) => {
        const startedAt = performance.now();
        let observer: MutationObserver | undefined;
        let interval: number | undefined;

        const cleanup = () => {
          observer?.disconnect();
          if (interval !== undefined) {
            window.clearInterval(interval);
          }
        };
        const finish = (value: {
          label: string;
          metrics?: {
            clientHeight: number;
            deltaFromBottom: number;
            scrollHeight: number;
            scrollTop: number;
          };
          ok: boolean;
          reason?: string;
          transcriptText?: string;
          url?: string;
        }) => {
          cleanup();
          resolve(value);
        };
        const check = () => {
          const current = metrics();
          if (!current) {
            finish(snapshot("chat transcript was not found"));
            return;
          }
          if (requireScrollable && current.scrollHeight <= current.clientHeight) {
            finish(snapshot("chat transcript was not scrollable"));
            return;
          }
          if (current.deltaFromBottom < minDistancePx) {
            finish(snapshot("chat transcript jumped back to bottom"));
            return;
          }
          if (performance.now() - startedAt >= waitMs) {
            finish({
              ok: true,
              label: checkLabel,
              metrics: current,
              transcriptText: document.querySelector(transcriptSelector)?.textContent?.trim(),
              url: window.location.href
            });
          }
        };

        observer = new MutationObserver(check);
        observer.observe(document.body, {
          attributes: true,
          attributeFilter: ["class", "data-testid", "style"],
          characterData: true,
          childList: true,
          subtree: true
        });
        interval = window.setInterval(check, 50);
        check();
      });
    }, {
      durationMs,
      label,
      minDistancePx: options.minDistancePx ?? 64,
      requireScrollable: options.requireScrollable ?? false
    });

    if (!result.ok) {
      throw new Error(`${label}: transcript should stay away from bottom: ${JSON.stringify(result, null, 2)}`);
    }
  }

  async expectUserMessageTextCount(
    text: string,
    expectedCount = 1,
    options: { matchMode?: "exact" | "contains"; stableMs?: number; timeoutMs?: number } = {}
  ): Promise<void> {
    const matchMode = options.matchMode ?? "exact";
    const timeoutMs = options.timeoutMs ?? 10_000;
    const stableMs = options.stableMs ?? 0;
    const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
    const targetText = normalize(text);
    let lastTexts: string[] = [];

    const matchingCount = async () => {
      lastTexts = await this.visibleUserMessageTexts();
      return lastTexts.filter((value) => {
        const normalized = normalize(value);
        return matchMode === "contains"
          ? normalized.includes(targetText)
          : normalized === targetText;
      }).length;
    };

    await expect.poll(matchingCount, {
      message: `expected ${expectedCount} visible user messages matching ${JSON.stringify(text)}; last texts: ${JSON.stringify(lastTexts)}`,
      timeout: timeoutMs
    }).toBe(expectedCount);

    const deadline = Date.now() + stableMs;
    while (Date.now() < deadline) {
      const count = await matchingCount();
      if (count !== expectedCount) {
        throw new Error([
          `Expected ${expectedCount} visible user messages matching ${JSON.stringify(text)} during ${stableMs}ms stability window, got ${count}.`,
          `Match mode: ${matchMode}.`,
          `Visible user messages: ${JSON.stringify(lastTexts)}`
        ].join(" "));
      }
      await this.page.waitForTimeout(250);
    }
  }

  async expectUserMessageSentinelOnce(
    sentinel: string,
    options: { stableMs?: number; timeoutMs?: number } = {}
  ): Promise<void> {
    await this.expectUserMessageTextCount(sentinel, 1, {
      matchMode: "contains",
      stableMs: options.stableMs ?? 3_000,
      timeoutMs: options.timeoutMs
    });
  }

  async waitForRenderedTranscriptImage(timeoutMs = 30_000, expectedCount = 1): Promise<void> {
    const images = this.page.getByTestId("transcript-user-message").locator("img[alt='Attached image']");
    await expect(images).toHaveCount(expectedCount, { timeout: timeoutMs });
    await expect.poll(async () => images.evaluateAll((elements) => {
      if (elements.length === 0) {
        return false;
      }
      return elements.every((element) => {
        if (!(element instanceof HTMLImageElement)) {
          return false;
        }
        const source = element.currentSrc || element.src;
        return Boolean(source) &&
          !source.startsWith("file:") &&
          element.complete &&
          element.naturalWidth > 0 &&
          element.naturalHeight > 0;
      });
    }), {
      message: `${expectedCount} attached transcript image(s) should load from browser-safe sources with non-zero dimensions`,
      timeout: timeoutMs
    }).toBe(true);
  }

  async currentThreadId(timeoutMs = 30_000, previousThreadId?: string): Promise<string> {
    const ignoredThreadId = previousThreadId ?? this.draftPreviousThreadId;
    await this.page.waitForFunction((previousId) => {
      const selectedThreadId = document.querySelector("[data-testid='coder-shell']")?.getAttribute("data-current-chat-id");
      const routeThreadId = window.location.pathname.match(/\/chats\/([^/]+)$/)?.[1];
      return Boolean(
        selectedThreadId &&
        routeThreadId &&
        selectedThreadId === routeThreadId &&
        (!previousId || selectedThreadId !== previousId)
      );
    }, ignoredThreadId, { timeout: timeoutMs });
    const threadId = await this.selectedThreadId();
    if (!threadId) {
      throw new Error(`Current page does not expose a thread id: ${this.page.url()}`);
    }
    if (threadId !== this.draftPreviousThreadId) {
      this.draftPreviousThreadId = undefined;
    }
    return threadId;
  }

  async waitForRouteThreadId(threadId: string, timeoutMs = 30_000): Promise<void> {
    await this.page.waitForURL((url) => url.pathname.endsWith(`/chats/${threadId}`), { timeout: timeoutMs });
  }

  async expectHydratedWorkspace(expectedThreadId?: string): Promise<string> {
    await this.page.getByTestId("coder-shell").waitFor({ timeout: 30_000 });
    await expect(this.page.getByTestId("chat-home")).toHaveCount(0);
    await expect(this.page.getByTestId("chat-empty")).toHaveCount(0);
    await expect(this.page.getByTestId("chat-error")).toHaveCount(0);
    await expect(this.page.getByTestId("chat-loading")).toHaveCount(0);
    await expect(this.page.getByTestId("chat-transcript")).toBeVisible({ timeout: 30_000 });
    await expect(this.page.getByTestId("model-control")).toBeVisible({ timeout: 10_000 });
    await expect(this.page.getByTestId("model-control")).not.toHaveText(/^Model$/);
    await expect(this.page.getByTestId("reasoning-control")).toBeVisible({ timeout: 10_000 });
    await expect(this.page.getByTestId("prompt-input")).toBeVisible({ timeout: 10_000 });
    const selectedThreadId = await this.selectedThreadId();
    if (!selectedThreadId) {
      throw new Error("Expected SSR hydrated workspace to expose data-current-chat-id.");
    }
    if (expectedThreadId && selectedThreadId !== expectedThreadId) {
      throw new Error(`Expected selected thread ${expectedThreadId}, got ${selectedThreadId}.`);
    }
    return selectedThreadId;
  }

  async expectActiveSwitcherRowExpanded(threadId: string): Promise<void> {
    await expect(this.page.getByTestId("coder-shell")).toHaveAttribute("data-hydrated", "true", { timeout: 30_000 });
    await this.openSwitcherForInspection();
    await this.page.locator(`[data-testid="chat-switcher-chat"][data-chat-id="${this.cssString(threadId)}"][aria-current="true"]`)
      .waitFor({ timeout: 10_000 });
    const state = await this.page.locator(`[data-testid="chat-switcher-chat"][data-chat-id="${this.cssString(threadId)}"]`).first()
      .evaluate((row) => {
        const project = row.closest("[data-testid='chat-switcher-project']");
        const header = project?.querySelector("button[aria-expanded], [role='button'][aria-expanded]");
        const list = row.closest("[data-testid='chat-switcher-project-chats']");
        return {
          headerExpanded: header?.getAttribute("aria-expanded"),
          listHidden: list?.hasAttribute("hidden") ?? null,
          projectId: project?.getAttribute("data-project-id") ?? null,
          rowAriaCurrent: row.getAttribute("aria-current")
        };
      });
    if (state.rowAriaCurrent !== "true" || state.headerExpanded !== "true" || state.listHidden) {
      throw new Error(`Active switcher row/project is not expanded: ${JSON.stringify(state)}`);
    }
    await this.closeSwitcher();
  }

  async openSwitcher(): Promise<void> {
    const switcher = await this.openSwitcherPanel();
    const groups = switcher.getByRole("region", { name: "Chat groups" });
    await groups.locator("[data-testid='chat-switcher-project']").first().waitFor({ timeout: 30_000 });
    await this.expandAllProjectGroups(groups);
    await this.revealAllVisibleProjectChats(groups);
  }

  async closeSwitcher(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await this.waitForSwitcherClosed();
  }

  async readSwitcherRows(options: { includeActive?: boolean } = {}): Promise<ClickSwitcherRow[]> {
    return this.page.locator('[data-testid="chat-switcher-chat"]').evaluateAll((rows, includeActive) =>
      rows.flatMap((row, index) => {
        const threadId = row.getAttribute("data-chat-id");
        if (!threadId) {
          return [];
        }
        if (!includeActive && row.getAttribute("aria-current") === "true") {
          return [];
        }

        return [{
          index,
          isRunning: row.getAttribute("data-running") === "true",
          isUnread: row.getAttribute("data-unread") === "true",
          projectId: row.getAttribute("data-project-id") ?? undefined,
          threadId,
          title: row.textContent?.trim() || undefined
        }];
      })
    , options.includeActive ?? true);
  }

  async expectSwitcherThreadRunning(threadId: string, timeoutMs = 30_000): Promise<void> {
    await this.openSwitcher();
    const row = this.switcherChatRow(threadId);
    await row.waitFor({ timeout: timeoutMs });
    await expect(row).toHaveAttribute("data-running", "true", { timeout: timeoutMs });
    const runningIndicator = row.getByTestId("chat-switcher-chat-running");
    await expect(runningIndicator).toBeVisible({ timeout: timeoutMs });
    await expect(runningIndicator).toHaveJSProperty("tagName", "OUTPUT");
    await expect(runningIndicator).not.toHaveCSS("animation-name", "none");
    await expect(row).not.toHaveAttribute("data-unread", "true");
    await expect(row.getByTestId("chat-switcher-chat-unread")).toHaveCount(0);
  }

  async expectSwitcherThreadUnread(threadId: string, timeoutMs = 30_000): Promise<void> {
    await this.openSwitcher();
    const row = this.switcherChatRow(threadId);
    await row.waitFor({ timeout: timeoutMs });
    await expect(row).toHaveAttribute("data-unread", "true", { timeout: timeoutMs });
    await expect(row.getByTestId("chat-switcher-chat-unread")).toBeVisible({ timeout: timeoutMs });
    await expect(row).not.toHaveAttribute("data-running", "true");
    await expect(row.getByTestId("chat-switcher-chat-running")).toHaveCount(0);
  }

  async expectSwitcherThreadNotUnread(threadId: string, timeoutMs = 30_000): Promise<void> {
    await this.openSwitcher();
    const row = this.switcherChatRow(threadId);
    await row.waitFor({ timeout: timeoutMs });
    await expect(row).not.toHaveAttribute("data-unread", "true", { timeout: timeoutMs });
    await expect(row.getByTestId("chat-switcher-chat-unread")).toHaveCount(0, { timeout: timeoutMs });
  }

  async openChatById(threadId: string): Promise<void> {
    await this.openSwitcher();
    const row = this.switcherChatRow(threadId);
    await row.waitFor({ timeout: 10_000 });
    await row.scrollIntoViewIfNeeded({ timeout: 5_000 });
    await row.click({ timeout: 5_000 }).catch(async (error: unknown) => {
      await this.attachOpenChatDiagnostics(threadId, row).catch(() => undefined);
      throw error;
    });
    await this.waitForSwitcherClosed();
    await this.page.waitForURL((url) => url.pathname.endsWith(`/chats/${threadId}`), { timeout: 20_000 });
  }

  async expectReadyThread(threadId: string): Promise<void> {
    await this.page.waitForURL((url) => url.pathname.endsWith(`/chats/${threadId}`), { timeout: 20_000 });
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const state = await this.readChatRenderState();

      if (state.hasEmptyPane || state.hasEmptyTranscript) {
        throw new Error(`Existing chat ${threadId} rendered an empty state while opening.`);
      }
      if (state.hasReadyTranscript) {
        return;
      }

      await this.page.waitForTimeout(state.hasLoading ? 100 : 50);
    }

    throw new Error(`Timed out waiting for existing chat ${threadId} to render a ready transcript.`);
  }

  async expectReadyThreadWithin(threadId: string, timeoutMs: number): Promise<void> {
    await this.page.waitForURL((url) => url.pathname.endsWith(`/chats/${threadId}`), { timeout: timeoutMs });
    const state = await this.page.evaluate(() => new Promise<{
      hasEmptyPane: boolean;
      hasEmptyTranscript: boolean;
      hasError: boolean;
      hasLoading: boolean;
      hasReadyTranscript: boolean;
    }>((resolve) => {
      window.requestAnimationFrame(() => {
        const transcript = document.querySelector('[data-testid="chat-transcript"]');
        const emptyTranscript = document.querySelector('[data-testid="chat-transcript-empty"]');
        const emptyPane = document.querySelector('[data-testid="chat-empty"]');
        const error = document.querySelector('[data-testid="chat-error"]');
        const loading = document.querySelector('[data-testid="chat-loading"][aria-busy="true"]');
        resolve({
          hasEmptyPane: Boolean(emptyPane),
          hasEmptyTranscript: Boolean(emptyTranscript),
          hasError: Boolean(error),
          hasLoading: Boolean(loading),
          hasReadyTranscript: Boolean(transcript && !emptyTranscript && !error)
        });
      });
    }));

    if (state.hasLoading || state.hasEmptyPane || state.hasEmptyTranscript || !state.hasReadyTranscript) {
      throw new Error(`Thread ${threadId} was not ready within ${timeoutMs}ms: ${JSON.stringify(state)}`);
    }
  }

  async expectNoAppError(): Promise<void> {
    await expect(this.page.getByTestId("chat-error")).toHaveCount(0);
  }

  async screenshot(label?: string): Promise<Buffer> {
    const path = label && this.testInfo
      ? this.testInfo.outputPath(`${label.replace(/[^a-zA-Z0-9._-]/g, "-")}.png`)
      : undefined;
    const body = await this.page.screenshot({ fullPage: true, path });
    if (label && this.testInfo) {
      await this.testInfo.attach(`${label}.png`, {
        path,
        contentType: "image/png"
      });
    }
    return body;
  }

  private async currentTranscriptStateSignature(): Promise<TranscriptStateSignature> {
    const transcript = this.page.getByTestId("chat-transcript");
    await expect(transcript).toBeVisible({ timeout: 30_000 });
    return transcript.evaluate((root): TranscriptStateSignature => {
      const normalize = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
      const visibleText = (element: Element) => normalize(
        "innerText" in element && typeof (element as HTMLElement).innerText === "string"
          ? (element as HTMLElement).innerText
          : element.textContent
      );
      const testId = (element: Element) => element.getAttribute("data-testid");
      const statLabels = (element: Element) => [...element.querySelectorAll("[aria-label^='Changed lines:']")]
        .map((stat) => stat.getAttribute("aria-label") ?? "")
        .sort();

      const rows = [...root.children].map((row, index): TranscriptRowSignature => {
        const controls = [...row.querySelectorAll("button")].map((button) => ({
          disabled: button instanceof HTMLButtonElement ? button.disabled : false,
          expanded: button.getAttribute("aria-expanded"),
          label: button.getAttribute("aria-label"),
          testId: testId(button),
          text: visibleText(button)
        }));
        const workEntries = [
          ...row.querySelectorAll("[data-testid='work-entry-activity-summary'], [data-testid='work-entry']")
        ].map((entry) => ({
          callCount: entry.getAttribute("data-work-entry-call-count"),
          command: entry.getAttribute("data-command"),
          expanded: entry.querySelector("button")?.getAttribute("aria-expanded") ?? null,
          hasDetails: entry.getAttribute("data-work-entry-has-details"),
          state: entry.getAttribute("data-work-entry-state"),
          testId: testId(entry),
          title: entry.getAttribute("data-work-entry-title"),
          type: entry.getAttribute("data-work-entry-type")
        }));
        const fileCards = [...row.querySelectorAll("[data-testid='file-change-card']")].map((card) => ({
          label: card.getAttribute("aria-label"),
          files: [...card.querySelectorAll("details")].map((file) => ({
            open: file.hasAttribute("open"),
            stats: statLabels(file),
            text: visibleText(file.querySelector("summary") ?? file)
          })),
          stats: statLabels(card),
          text: visibleText(card)
        }));
        const links = [...row.querySelectorAll("a")].map((link) => ({
          href: link.getAttribute("href"),
          text: visibleText(link)
        }));
        const images = [...row.querySelectorAll("img")].map((image) => ({
          alt: image.getAttribute("alt"),
          testId: testId(image)
        }));

        return {
          ariaLabel: row.getAttribute("aria-label"),
          controls,
          fileCards,
          images,
          index,
          links,
          role: row.getAttribute("data-row-role"),
          rowFinal: row.getAttribute("data-row-final"),
          rowState: row.getAttribute("data-row-state"),
          rowType: row.getAttribute("data-row-type"),
          testId: testId(row),
          text: visibleText(row),
          workEntries,
          workEntryCount: row.getAttribute("data-work-entry-count")
        };
      });

      return {
        rows,
        rowCount: rows.length,
        text: visibleText(root)
      };
    });
  }

  private async openSwitcherForInspection(): Promise<void> {
    await this.openSwitcherPanel();
    await this.page.getByTestId("chat-switcher-groups").waitFor({ timeout: 30_000 });
  }

  private async visibleUserMessageTexts(): Promise<string[]> {
    return this.page.locator('[data-testid="transcript-user-message"]').evaluateAll((elements) => elements
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== "hidden" &&
          style.display !== "none" &&
          Number(style.opacity) !== 0 &&
          rect.width > 0 &&
          rect.height > 0;
      })
      .map((element) => element.textContent?.trim() ?? ""));
  }

  private async openSwitcherPanel() {
    const switcher = this.page.locator("[data-testid='chat-switcher-panel']");
    await this.page.locator("[data-testid='chat-switcher-panel'][data-state='closing']").waitFor({ state: "hidden", timeout: 2_000 }).catch(() => undefined);
    const existingSwitcher = switcher.filter({ has: this.page.getByTestId("chat-switcher-groups") }).first();
    if (
      await existingSwitcher.isVisible({ timeout: 500 }).catch(() => false) &&
      await existingSwitcher.getAttribute("data-state", { timeout: 500 }).catch(() => undefined) === "open"
    ) {
      return switcher;
    }
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      await this.clickOpenSwitcherButton();
      if (await switcher.filter({ has: this.page.getByTestId("chat-switcher-groups") }).isVisible({ timeout: 1_000 }).catch(() => false)) {
        break;
      }
      await this.page.waitForTimeout(250);
    }
    await switcher.filter({ has: this.page.getByTestId("chat-switcher-groups") }).waitFor({ timeout: 1_000 });
    await switcher.evaluate((element) => element.getAttribute("data-state") === "open"
      ? undefined
      : new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          observer.disconnect();
          reject(new Error("Timed out waiting for chat switcher to open"));
        }, 30_000);
        const observer = new MutationObserver(() => {
          if (element.getAttribute("data-state") === "open") {
            window.clearTimeout(timeout);
            observer.disconnect();
            resolve();
          }
        });
        observer.observe(element, { attributes: true, attributeFilter: ["data-state"] });
      }));
    return switcher;
  }

  private async expandAllProjectGroups(groups: Locator): Promise<void> {
    for (let index = 0; index < 50; index += 1) {
      const expandProject = groups.getByRole("button", { name: /^Expand / }).first();
      if (!await expandProject.isVisible().catch(() => false)) {
        return;
      }
      await expandProject.click({ timeout: 5_000 });
    }

    throw new Error("Could not expand all project groups after 50 clicks.");
  }

  private async revealAllVisibleProjectChats(groups: Locator): Promise<void> {
    for (let index = 0; index < 50; index += 1) {
      const showMore = groups.getByRole("button", { name: /^Show more chats in / }).first();
      if (!await showMore.isVisible().catch(() => false)) {
        return;
      }
      await showMore.click({ timeout: 5_000 });
    }

    throw new Error("Could not reveal all chat rows after 50 clicks.");
  }

  private async waitForSwitcherClosed(): Promise<void> {
    await this.page.waitForFunction(() =>
      document.querySelector("[data-testid='chat-switcher-panel']")?.getAttribute("data-state") !== "open",
    undefined, { timeout: 5_000 });
  }

  private async attachOpenChatDiagnostics(threadId: string, row: Locator): Promise<void> {
    const diagnostics = await row.evaluate((target) => {
      const rect = target.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const topElement = document.elementFromPoint(centerX, centerY);
      const describe = (element: Element | null) => element
        ? {
          ariaCurrent: element.getAttribute("aria-current"),
          ariaHidden: element.getAttribute("aria-hidden"),
          className: element.getAttribute("class"),
          dataChatId: element.getAttribute("data-chat-id"),
          dataState: element.getAttribute("data-state"),
          dataTestId: element.getAttribute("data-testid"),
          id: element.id || undefined,
          tagName: element.tagName,
          text: element.textContent?.trim().slice(0, 160)
        }
        : null;
      const computed = window.getComputedStyle(target);
      const panel = document.querySelector("[data-testid='chat-switcher-panel']");
      const scrim = document.querySelector("[aria-label='Close chats']");
      const duplicateRows = [...document.querySelectorAll(`[data-testid="chat-switcher-chat"][data-chat-id="${CSS.escape(target.getAttribute("data-chat-id") ?? "")}"]`)];

      return {
        activeElement: describe(document.activeElement),
        center: { x: centerX, y: centerY },
        duplicateRows: duplicateRows.map((rowElement) => {
          const rowRect = rowElement.getBoundingClientRect();
          return {
            ariaCurrent: rowElement.getAttribute("aria-current"),
            rect: {
              bottom: rowRect.bottom,
              height: rowRect.height,
              left: rowRect.left,
              right: rowRect.right,
              top: rowRect.top,
              width: rowRect.width
            },
            text: rowElement.textContent?.trim().slice(0, 160)
          };
        }),
        location: window.location.href,
        panel: panel
          ? {
            ariaHidden: panel.getAttribute("aria-hidden"),
            dataState: panel.getAttribute("data-state"),
            rect: rectOf(panel),
            styles: stylesOf(panel)
          }
          : null,
        row: {
          attributes: describe(target),
          rect: {
            bottom: rect.bottom,
            height: rect.height,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            width: rect.width
          },
          styles: {
            display: computed.display,
            opacity: computed.opacity,
            pointerEvents: computed.pointerEvents,
            transform: computed.transform,
            visibility: computed.visibility,
            zIndex: computed.zIndex
          }
        },
        scrim: scrim
          ? {
            disabled: scrim instanceof HTMLButtonElement ? scrim.disabled : undefined,
            dataState: scrim.getAttribute("data-state"),
            rect: rectOf(scrim),
            styles: stylesOf(scrim)
          }
          : null,
        topElement: describe(topElement),
        topChatRow: describe(topElement?.closest("[data-testid='chat-switcher-chat']") ?? null)
      };

      function rectOf(element: Element) {
        const elementRect = element.getBoundingClientRect();
        return {
          bottom: elementRect.bottom,
          height: elementRect.height,
          left: elementRect.left,
          right: elementRect.right,
          top: elementRect.top,
          width: elementRect.width
        };
      }

      function stylesOf(element: Element) {
        const elementStyles = window.getComputedStyle(element);
        return {
          display: elementStyles.display,
          opacity: elementStyles.opacity,
          pointerEvents: elementStyles.pointerEvents,
          transform: elementStyles.transform,
          visibility: elementStyles.visibility,
          zIndex: elementStyles.zIndex
        };
      }
    });
    const payload = {
      phase: "click-failed",
      threadId,
      timestamp: new Date().toISOString(),
      diagnostics
    };
    console.log(`[click-e2e:open-chat:click-failed] ${JSON.stringify(payload)}`);
    if (this.testInfo) {
      await this.testInfo.attach(`open-chat-click-failed-${threadId.slice(0, 8)}.json`, {
        body: JSON.stringify(payload, null, 2),
        contentType: "application/json"
      });
    }
  }

  private async clickOpenSwitcherButton(): Promise<void> {
    const sidebarButton = this.page.getByTestId("switch-chats-button");
    if (await sidebarButton.isVisible().catch(() => false)) {
      await sidebarButton.click({ timeout: 10_000 });
      return;
    }

    const dockButton = this.page.getByTestId("workspace-menu-button");
    if (await dockButton.isVisible().catch(() => false)) {
      await dockButton.click({ timeout: 10_000 });
      return;
    }

    throw new Error("Could not find a visible chat switcher button.");
  }

  private async expectBackendModelListReady(timeoutMs = 30_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let observedModels: string[] = [];

    while (Date.now() < deadline) {
      observedModels = await this.latestBackendModelIds().catch(() => []);
      if (observedModels.length > 1 || observedModels.some((model) => /codex/i.test(model))) {
        return;
      }

      await this.page.waitForTimeout(500);
    }

    throw new Error(`Live app backend model list did not load before timeout. Observed models: ${JSON.stringify(observedModels)}`);
  }

  private async latestBackendModelIds(): Promise<string[]> {
    const response = await this.requestCodex("model/list", {
      includeHidden: false,
      limit: 100
    });
    const data = response && typeof response === "object" && "data" in response
      ? (response as { data?: unknown }).data
      : undefined;
    return Array.isArray(data)
      ? data.flatMap((model) => {
        if (!model || typeof model !== "object") {
          return [];
        }
        const id = "id" in model && typeof model.id === "string" ? model.id : undefined;
        const modelName = "model" in model && typeof model.model === "string" ? model.model : undefined;
        return [id, modelName].filter((value): value is string => Boolean(value));
      })
      : [];
  }

  private async requestCodex(method: string, params: Record<string, unknown>): Promise<unknown> {
    const socket = io(`${this.origin()}/codex`, {
      path: "/app-socket",
      auth: { appSessionId: `click-e2e-${Date.now()}` },
      transports: ["websocket", "polling"]
    });

    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timed out connecting to codex socket")), 10_000);
        socket.once("connect", () => {
          clearTimeout(timeout);
          resolve();
        });
        socket.once("connect_error", (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      const response = await new Promise<{ ok: boolean; result?: unknown; error?: unknown }>((resolve) => {
        socket.emit("request", { method, params }, resolve);
      });

      if (!response.ok) {
        throw new Error(`${method} failed: ${JSON.stringify(response.error)}`);
      }

      return response.result;
    } finally {
      socket.close();
    }
  }

  private async openModelPopover(timeoutMs = 2_000): Promise<boolean> {
    const control = this.page.getByTestId("model-control");
    const popover = this.page.getByTestId("model-popover");

    await control.waitFor({ timeout: 10_000 });
    if (await popover.isVisible({ timeout: 500 }).catch(() => false)) {
      return true;
    }

    await control.click({ timeout: 10_000 });
    if (await popover.isVisible({ timeout: 500 }).catch(() => false)) {
      return true;
    }

    await control.press("Enter", { timeout: 2_000 }).catch(() => undefined);
    if (await popover.isVisible({ timeout: 500 }).catch(() => false)) {
      return true;
    }

    await control.press(" ", { timeout: 2_000 }).catch(() => undefined);
    if (await popover.isVisible({ timeout: 500 }).catch(() => false)) {
      return true;
    }

    await control.dispatchEvent("click").catch(() => undefined);
    return await popover.isVisible({ timeout: timeoutMs }).catch(() => false);
  }

  private async readModelOptions(): Promise<Array<{ id: string; label: string }>> {
    return this.page.getByTestId("model-popover").locator("[data-testid^='model-option-']").evaluateAll((buttons) =>
      buttons.map((button) => ({
        id: button.getAttribute("data-testid")?.replace(/^model-option-/, "") ?? "",
        label: button.textContent ?? ""
      }))
    );
  }

  private async readChatRenderState() {
    return this.page.evaluate(() => {
      const transcript = document.querySelector('[data-testid="chat-transcript"]');
      const emptyTranscript = document.querySelector('[data-testid="chat-transcript-empty"]');
      const emptyPane = document.querySelector('[data-testid="chat-empty"]');
      const error = document.querySelector('[data-testid="chat-error"]');
      const loading = document.querySelector('[data-testid="chat-loading"][aria-busy="true"]');
      return {
        hasEmptyPane: Boolean(emptyPane),
        hasEmptyTranscript: Boolean(emptyTranscript),
        hasError: Boolean(error),
        hasLoading: Boolean(loading),
        hasReadyTranscript: Boolean(transcript && !emptyTranscript && !error)
      };
    });
  }

  private switcherChatRow(threadId: string): Locator {
    return this.page.locator(`[data-testid="chat-switcher-chat"][data-chat-id="${this.cssString(threadId)}"]`).first();
  }

  private async selectedThreadId(): Promise<string | undefined> {
    const threadId = await this.page.getByTestId("coder-shell").getAttribute("data-current-chat-id");
    return threadId || undefined;
  }

  private async isDraftHomeVisible(): Promise<boolean> {
    const hasHome = await this.page.getByTestId("chat-home").isVisible({ timeout: 500 }).catch(() => false);
    if (!hasHome) {
      return false;
    }
    return !await this.selectedThreadId();
  }

  private origin(): string {
    const currentUrl = this.page.url();
    if (currentUrl.startsWith("http://") || currentUrl.startsWith("https://")) {
      return new URL(currentUrl).origin;
    }
    const port = Number.parseInt(process.env.CODER_E2E_PORT ?? "5173", 10);
    return `http://127.0.0.1:${port}`;
  }

  private cssString(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
  }
}
