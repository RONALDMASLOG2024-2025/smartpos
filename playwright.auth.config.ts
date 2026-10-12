import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/auth",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:5180", headless: true },
  reporter: "list",
  webServer: {
    command: "npm run dev -- --port 5180 --strictPort",
    url: "http://127.0.0.1:5180",
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: "https://smartpos-auth.test",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_auth_test",
      VITE_ENABLE_DEMO: "false",
    },
  },
});
