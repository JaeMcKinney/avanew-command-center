import { defineConfig, devices } from "@playwright/test"

// End-to-end tests drive the real app in a browser against the local
// Supabase stack (start it first with `npm run db:start`), the server
// functions and a mock Tavus API.
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:5180", trace: "off" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] }, testMatch: /(accessibility|phone)\.spec\.ts/ },
  ],
  webServer: [
    { command: "npm run mock-tavus", url: "http://127.0.0.1:54398/__control/health", reuseExistingServer: true },
    { command: "npm run functions", url: "http://127.0.0.1:54399/health", reuseExistingServer: true },
    // Dropbox and Google Drive only appear when their keys are set; the tests stand in for both services.
    { command: "npm run dev", url: "http://127.0.0.1:5180", reuseExistingServer: true, env: { VITE_DROPBOX_APP_KEY: "test-dropbox-key", VITE_GOOGLE_CLIENT_ID: "test-google-client" } },
  ],
})
