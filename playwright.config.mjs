import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

// One unpredictable administrator password per run. Workers and the launched
// server inherit it from this process, so it is generated only once. Export
// WIREDRAFT_E2E_ADMIN_PASSWORD yourself to reuse an already running server.
process.env.WIREDRAFT_E2E_ADMIN_PASSWORD ||= randomBytes(24).toString("base64url");

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:41817";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "**/visual.spec.mjs",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Browser projects share one real persistence server. Serial workers keep
  // mutations deterministic while the CI browser matrix still runs in parallel.
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "line",
  outputDir: "test-results/playwright",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    colorScheme: "dark",
    reducedMotion: "reduce",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: "node scripts/playwright-server.mjs",
    url: `${baseURL}/api/v1/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "edge", use: { ...devices["Desktop Edge"], channel: "msedge" } },
  ],
});
