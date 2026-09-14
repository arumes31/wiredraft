import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./browser-tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: "list",
  outputDir: "test-results/workspace",
  use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 },
    baseURL: "http://127.0.0.1:41819", reducedMotion: "reduce", trace: "retain-on-failure", screenshot: "only-on-failure" },
});
