import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { ClickAppPage, type ClickThread } from "./support/ClickAppPage";

const forwardLimit = Number.parseInt(process.env.CODER_E2E_FORWARD_THREAD_LIMIT ?? "20", 10);
const relaxedSwitchClickCount = Number.parseInt(process.env.CODER_E2E_RELAXED_SWITCH_CLICK_COUNT ?? process.env.CODER_E2E_SWITCH_CLICK_COUNT ?? "5", 10);
const strictSwitchClickCount = Number.parseInt(process.env.CODER_E2E_STRICT_SWITCH_CLICK_COUNT ?? process.env.CODER_E2E_SWITCH_CLICK_COUNT ?? "5", 10);
const cachedSwitchReadyMs = Number.parseInt(process.env.CODER_E2E_CACHED_SWITCH_READY_MS ?? "100", 10);

type ClickOrderEntry = ClickThread & {
  index: number;
  name: string;
  visibleOrder: string[];
};

test.describe("latest real thread loading click e2e", () => {
  test("opens latest real threads top-down", async ({ page }, testInfo) => {
    const app = new ClickAppPage(page, testInfo);
    const history = new ClickHistory("forward-sweep", testInfo);

    try {
      await app.gotoLiveApp();
      const backendThreads = await app.latestBackendThreads(forwardLimit);
      history.setBackendThreads(backendThreads);
      expect(backendThreads.length).toBeGreaterThan(0);

      const threads = await app.visibleThreads(forwardLimit);
      history.setPlannedThreads(threads);
      expect(threads.length).toBeGreaterThan(0);
      await history.capture(app, "drawer-open", -1, threads[0]?.threadId ?? "empty");

      for (const [clickIndex, thread] of threads.entries()) {
        await test.step(`open thread ${clickIndex + 1}/${threads.length}: ${thread.threadId}`, async () => {
          try {
            await app.openSwitcher();
            const visibleOrder = (await app.readSwitcherRows()).map((row) => row.threadId);
            await app.closeSwitcher();
            await app.openChatById(thread.threadId);
            await history.capture(app, "chat-clicked", clickIndex, thread.threadId);
            history.record({
              ...thread,
              index: clickIndex,
              name: `open thread ${clickIndex + 1}/${threads.length}`,
              visibleOrder
            });
            await app.expectReadyThread(thread.threadId);
            await app.expectNoAppError();
            await history.capture(app, "success", clickIndex, thread.threadId);
          } catch (error) {
            await history.capture(app, "failure", clickIndex, thread.threadId).catch(() => undefined);
            await history.attachFailure().catch(() => undefined);
            throw error;
          }
        });
      }

      await history.attach();
    } catch (error) {
      await history.attachFailure();
      throw error;
    }
  });

  test("switches between two real threads repeatedly with relaxed readiness", async ({ page }, testInfo) => {
    await runTwoThreadSwitchTest({
      clickCount: relaxedSwitchClickCount,
      page,
      suiteName: "two-thread-switch-relaxed",
      testInfo,
      verify: async ({ app, thread }) => {
        await app.expectReadyThread(thread.threadId);
      }
    });
  });

  test("switches between two already opened threads within cached readiness budget", async ({ page }, testInfo) => {
    await runTwoThreadSwitchTest({
      clickCount: strictSwitchClickCount,
      page,
      suiteName: "two-thread-switch-strict",
      testInfo,
      verify: async ({ app, clickIndex, thread }) => {
        if (clickIndex < 2) {
          await app.expectReadyThread(thread.threadId);
          return;
        }

        await app.expectReadyThreadWithin(thread.threadId, cachedSwitchReadyMs);
      }
    });
  });
});

async function runTwoThreadSwitchTest({
  clickCount,
  page,
  suiteName,
  testInfo,
  verify
}: {
  clickCount: number;
  page: Page;
  suiteName: string;
  testInfo: TestInfo;
  verify: (context: {
    app: ClickAppPage;
    clickIndex: number;
    thread: ClickThread;
    visibleOrder: string[];
  }) => Promise<void>;
}): Promise<void> {
  const app = new ClickAppPage(page, testInfo);
  const history = new ClickHistory(suiteName, testInfo);

  try {
    await app.gotoLiveApp();
    const backendThreads = await app.latestBackendThreads(2);
    history.setBackendThreads(backendThreads);
    expect(backendThreads.length).toBeGreaterThan(0);

    const threads = await app.visibleThreads(2);
    history.setPlannedThreads(threads);
    expect(threads.length).toBeGreaterThanOrEqual(2);
    await history.capture(app, "drawer-open", -1, threads[0]?.threadId ?? "empty");

    for (let clickIndex = 0; clickIndex < clickCount; clickIndex += 1) {
      const thread = clickIndex % 2 === 0 ? threads[0]! : threads[1]!;
      await test.step(`switch ${clickIndex + 1}/${clickCount}: ${thread.threadId}`, async () => {
        try {
          await app.openSwitcher();
          const visibleOrder = (await app.readSwitcherRows()).map((row) => row.threadId);
          await app.closeSwitcher();
          await app.openChatById(thread.threadId);
          await history.capture(app, "chat-clicked", clickIndex, thread.threadId);
          history.record({
            ...thread,
            index: clickIndex,
            name: `switch ${clickIndex + 1}/${clickCount}`,
            visibleOrder
          });
          await verify({ app, clickIndex, thread, visibleOrder });
          await app.expectNoAppError();
          await history.capture(app, "success", clickIndex, thread.threadId);
        } catch (error) {
          await history.capture(app, "failure", clickIndex, thread.threadId).catch(() => undefined);
          await history.attachFailure().catch(() => undefined);
          throw error;
        }
      });
    }
    await history.attach();
  } catch (error) {
    await history.attachFailure();
    throw error;
  }
}

class ClickHistory {
  private backendThreads: ClickThread[] = [];
  private plannedThreads: ClickThread[] = [];
  private readonly entries: ClickOrderEntry[] = [];

  constructor(
    private readonly suiteName: string,
    private readonly testInfo: TestInfo
  ) {}

  setBackendThreads(threads: readonly ClickThread[]): void {
    this.backendThreads = [...threads];
  }

  setPlannedThreads(threads: readonly ClickThread[]): void {
    this.plannedThreads = [...threads];
  }

  record(entry: ClickOrderEntry): void {
    this.entries.push(entry);
  }

  async capture(app: ClickAppPage, kind: "chat-clicked" | "drawer-open" | "failure" | "success", index: number, threadId: string): Promise<void> {
    const name = `${this.suiteName}-${String(index + 1).padStart(2, "0")}-${kind}-${threadId.slice(0, 8)}.png`;
    await this.testInfo.attach(name, {
      body: await app.screenshot(),
      contentType: "image/png"
    });
  }

  async attach(fileName = `${this.suiteName}-click-order.json`): Promise<void> {
    const historyPath = this.testInfo.outputPath(fileName);
    await writeFile(historyPath, JSON.stringify({
      suiteName: this.suiteName,
      backendThreadOrder: this.backendThreads.map((thread) => thread.threadId),
      plannedDrawerThreadOrder: this.plannedThreads.map((thread) => thread.threadId),
      clickedThreadOrder: this.entries
    }, null, 2));
    await this.testInfo.attach(fileName, {
      path: historyPath,
      contentType: "application/json"
    });
  }

  async attachFailure(fileName = `${this.suiteName}-click-order-failure.json`): Promise<void> {
    await this.attach(fileName);
  }
}
