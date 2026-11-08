import { defineConfig, devices } from "@playwright/test";

const base = process.env.E2E_BASE_URL || "http://localhost:3000";
export default defineConfig({
  testDir: "e2e",
  timeout: 240_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: base, trace: "retain-on-failure", screenshot: "only-on-failure", locale: "en-GB", timezoneId: "Europe/London" },
  projects: [
    { name: "iphone", use: { ...devices["iPhone 15"] } },
    { name: "ipad", use: { ...devices["iPad Pro 11"] } },
    { name: "android", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
});
