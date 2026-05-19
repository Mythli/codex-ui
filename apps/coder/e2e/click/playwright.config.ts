import { defineConfig, devices } from "@playwright/test";

const port = Number.parseInt(process.env.CODER_E2E_PORT ?? "5173", 10);
const baseURL = `http://127.0.0.1:${port}`;
const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR ?? "test-results/click/local";

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts/,
  outputDir,
  timeout: 120_000,
  workers: 1,
  expect: {
    timeout: 20_000
  },
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "on"
  },
  webServer: {
    command: `pnpm exec vite dev --host 127.0.0.1 --port ${port} --strictPort`,
    url: `${baseURL}/@vite/client`,
    reuseExistingServer: true,
    timeout: 60_000
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"]
      }
    }
  ]
});
