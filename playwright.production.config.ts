import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/production",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:5174", headless: true },
  reporter: "list",
  webServer: {
    command: "npm run preview -- --port 5174",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
