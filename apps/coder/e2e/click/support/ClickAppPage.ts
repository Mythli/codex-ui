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

export class ClickAppPage {
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
      await this.page.getByTestId("new-chat-button").click({ timeout: 2_000 });
      const projectOption = this.page.getByRole("menuitem").first();
      if (await projectOption.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await projectOption.click({ timeout: 2_000 });
      }
      if (await this.isDraftHomeVisible()) {
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

  async waitForAssistantText(textOrPattern: string | RegExp, timeoutMs = 120_000): Promise<void> {
    const transcript = this.page.getByTestId("chat-transcript");
    await expect(transcript).toBeVisible({ timeout: timeoutMs });
    await expect(transcript).toContainText(textOrPattern, { timeout: timeoutMs });
  }

  async currentThreadId(timeoutMs = 30_000): Promise<string> {
    await this.page.waitForFunction(() => {
      const routeThreadId = /\/chats\/[^/]+$/.test(window.location.pathname);
      const selectedThreadId = document.querySelector("[data-testid='coder-shell']")?.getAttribute("data-current-chat-id");
      return Boolean(routeThreadId || selectedThreadId);
    }, undefined, { timeout: timeoutMs });
    const threadId = this.threadIdFromUrl() ?? await this.selectedThreadId();
    if (!threadId) {
      throw new Error(`Current page does not expose a thread id: ${this.page.url()}`);
    }
    return threadId;
  }

  async waitForRouteThreadId(threadId: string, timeoutMs = 30_000): Promise<void> {
    await this.page.waitForURL((url) => url.pathname.endsWith(`/chats/${threadId}`), { timeout: timeoutMs });
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

  private threadIdFromUrl(): string | undefined {
    const match = /\/chats\/([^/]+)$/.exec(new URL(this.page.url()).pathname);
    return match?.[1];
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
