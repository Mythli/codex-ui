import { expect, test } from "@playwright/test";
import { ClickAppPage } from "./support/ClickAppPage";

test.describe("SSR initial chat hydration", () => {
  test("redirects root to latest chat with transcript, menu state, and composer data", async ({ page }, testInfo) => {
    const app = new ClickAppPage(page, testInfo);
    const [latestThread] = await app.latestBackendThreads(1);
    expect(latestThread?.threadId).toBeTruthy();

    await page.goto("/");
    await page.waitForURL((url) => /\/chats\/[^/]+$/.test(url.pathname), { timeout: 30_000 });
    const threadId = new URL(page.url()).pathname.split("/").at(-1);
    if (!threadId) {
      throw new Error(`Root did not redirect to a chat route: ${page.url()}`);
    }
    await app.expectHydratedWorkspace(threadId);
    await app.expectActiveSwitcherRowExpanded(threadId);
    await app.expectNoAppError();
  });

  test("loads and reloads a direct thread route with transcript, project, and composer data", async ({ page }, testInfo) => {
    const app = new ClickAppPage(page, testInfo);
    const [latestThread] = await app.latestBackendThreads(1);
    expect(latestThread?.threadId).toBeTruthy();
    const threadId = latestThread!.threadId;

    await page.goto(`/chats/${threadId}`);
    await app.expectHydratedWorkspace(threadId);
    await app.expectActiveSwitcherRowExpanded(threadId);
    await app.expectNoAppError();

    await page.reload();
    await app.waitForRouteThreadId(threadId);
    await app.expectHydratedWorkspace(threadId);
    await app.expectActiveSwitcherRowExpanded(threadId);
    await app.expectNoAppError();
  });
});
