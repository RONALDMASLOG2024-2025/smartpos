import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/uat",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1440, height: 1000 },
    headless: true,
    trace: "retain-on-failure",
  },
  reporter: [
    ["list"],
    ["html", { outputFolder: "docs/uat/playwright-report", open: "never" }],
  ],
  outputDir: "test-results",
});
