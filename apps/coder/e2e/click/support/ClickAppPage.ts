import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { io } from "socket.io-client";

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
  transcriptText: string;
  userMessageTexts: string[];
  workBlockTexts: string[];
};

export class ClickAppPage {
  private draftPreviousThreadId?: string;

  constructor(
    private readonly page: Page,
    private readonly testInfo?: TestInfo
  ) {}

  async gotoLiveApp(): Promise<void> {
    await this.page.goto("/");
    await this.page.getByTestId("coder-shell").waitFor({ timeout: 20_000 });
    await this.page.getByRole("button", { name: "Open sidebar" }).waitFor({ timeout: 20_000 });
    await this.expectNoAppError();
    await this.expectBackendModelListReady();
  }

  async latestBackendThreads(limit: number): Promise<ClickThread[]> {
    const response = await this.requestCodex("thread/list", {
      limit,
      sortKey: "updated_at",
      sortDirection: "desc",
      sourceKinds: [],
      archived: false,
      cwd: null
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
      timeoutMs
    });
  }

  async sendPromptAndExpectTurnWithin(
    text: string,
    options: {
      expectNoComposerAttachmentsBeforeSend?: boolean;
      matchMode?: "exact" | "contains";
      timeoutMs?: number;
    } = {}
  ): Promise<void> {
    const timeoutMs = options.timeoutMs ?? 100;
    const matchMode = options.matchMode ?? "exact";
    const promptInput = this.page.getByTestId("prompt-input");
    const sendButton = this.page.getByTestId("send-prompt-button");

    if (options.expectNoComposerAttachmentsBeforeSend ?? true) {
      await expect(this.page.getByTestId("composer-attachments")).toHaveCount(0);
    }
    await promptInput.fill(text);
    await expect(sendButton).toBeEnabled({ timeout: 10_000 });

    const watcherId = `prompt-turn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await this.page.evaluate(({ watcherId, text, timeoutMs, matchMode }) => {
      const browserWindow = window as typeof window & {
        __codexPromptTurnWatchers?: Record<string, Promise<PromptTurnVisibilityResult>>;
      };
      browserWindow.__codexPromptTurnWatchers ??= {};

      const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
      const targetText = normalize(text);
      const userMessageSelector = '[data-testid="transcript-user-message"]';
      const workBlockSelector = '[data-testid="transcript-work-block"][data-row-state="working"]';

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
      const visibleWorkBlockTexts = () => visibleTexts(workBlockSelector);

      const diagnostics = (reason: string, startedAt?: number): PromptTurnVisibilityResult => ({
        ok: false,
        elapsedMs: startedAt === undefined ? undefined : performance.now() - startedAt,
        reason,
        location: window.location.href,
        currentChatId: document.querySelector("[data-testid='coder-shell']")?.getAttribute("data-current-chat-id") ?? undefined,
        matchMode,
        promptValue: (document.querySelector("[data-testid='prompt-input']") as HTMLTextAreaElement | null)?.value ?? "",
        targetText: text,
        timeoutMs,
        transcriptText: document.querySelector("[data-testid='chat-transcript']")?.textContent?.trim() ?? "",
        userMessageTexts: visibleUserMessageTexts(),
        workBlockTexts: visibleWorkBlockTexts()
      });

      browserWindow.__codexPromptTurnWatchers[watcherId] = new Promise<PromptTurnVisibilityResult>((resolve) => {
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
        let clickTimeout: number | undefined;
        let settled = false;

        const cleanup = () => {
          observer?.disconnect();
          if (timeout !== undefined) {
            window.clearTimeout(timeout);
          }
          if (clickTimeout !== undefined) {
            window.clearTimeout(clickTimeout);
          }
          button.removeEventListener("click", handleClick, { capture: true });
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
            return matchMode === "contains"
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
              matchMode,
              promptValue: (document.querySelector("[data-testid='prompt-input']") as HTMLTextAreaElement | null)?.value ?? "",
              targetText: text,
              timeoutMs,
              transcriptText: document.querySelector("[data-testid='chat-transcript']")?.textContent?.trim() ?? "",
              userMessageTexts: visibleUserMessageTexts(),
              workBlockTexts: visibleWorkBlockTexts()
            });
          }
        };

        function handleClick() {
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
          timeout = window.setTimeout(() => {
            finish({
              ...diagnostics("user message and running work block were not both visible before timeout", startedAt),
              userMessageElapsedMs,
              workBlockElapsedMs
            });
          }, timeoutMs);
        }

        button.addEventListener("click", handleClick, { once: true, capture: true });
        clickTimeout = window.setTimeout(() => {
          finish(diagnostics("send button click was not observed"));
        }, 10_000);
      });
    }, { watcherId, text, timeoutMs, matchMode });

    await sendButton.click();
    const result = await this.page.evaluate(async (watcherId): Promise<PromptTurnVisibilityResult> => {
      const browserWindow = window as typeof window & {
        __codexPromptTurnWatchers?: Record<string, Promise<PromptTurnVisibilityResult>>;
      };
      const watcher = browserWindow.__codexPromptTurnWatchers?.[watcherId];
      if (!watcher) {
        throw new Error(`Prompt turn watcher ${watcherId} was not registered.`);
      }
      try {
        return await watcher;
      } finally {
        delete browserWindow.__codexPromptTurnWatchers?.[watcherId];
      }
    }, watcherId);

    if (!result.ok) {
      throw new Error(`Prompt turn was not visible within ${timeoutMs}ms: ${JSON.stringify(result, null, 2)}`);
    }
    if ((result.elapsedMs ?? Number.POSITIVE_INFINITY) > timeoutMs) {
      throw new Error(`Prompt turn became visible after ${result.elapsedMs}ms, over ${timeoutMs}ms: ${JSON.stringify(result, null, 2)}`);
    }

    await expect(promptInput).toHaveValue("", { timeout: 10_000 });
  }

  async sendPromptWithFiles(text: string, filePaths: string[]): Promise<void> {
    await this.page.getByTestId("composer-file-input").setInputFiles(filePaths);
    await expect(this.page.getByTestId("composer-attachments").locator("img, [aria-hidden='true']").first())
      .toBeVisible({ timeout: 10_000 });
    await this.sendPromptAndExpectTurnWithin(text, {
      expectNoComposerAttachmentsBeforeSend: false,
      matchMode: "contains"
    });
    await expect(this.page.getByTestId("composer-attachments")).toHaveCount(0, { timeout: 10_000 });
  }

  async waitForAssistantText(textOrPattern: string | RegExp, timeoutMs = 120_000): Promise<void> {
    const transcript = this.page.getByTestId("chat-transcript");
    await expect(transcript).toBeVisible({ timeout: timeoutMs });
    await expect(transcript).toContainText(textOrPattern, { timeout: timeoutMs });
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

  async waitForRenderedTranscriptImage(timeoutMs = 30_000): Promise<void> {
    const image = this.page.getByTestId("transcript-user-message").locator("img[alt='Attached image']").first();
    await expect(image).toBeVisible({ timeout: timeoutMs });
    await expect.poll(async () => image.evaluate((element) => {
      if (!(element instanceof HTMLImageElement)) {
        return false;
      }
      return element.complete && element.naturalWidth > 0 && element.naturalHeight > 0;
    }), {
      message: "attached transcript image should load with non-zero dimensions",
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
        const header = project?.querySelector("[role='button'][aria-expanded]");
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

  async openChatById(threadId: string): Promise<void> {
    await this.openSwitcher();
    const row = this.page.locator(`[data-testid="chat-switcher-chat"][data-chat-id="${this.cssString(threadId)}"]`).first();
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
