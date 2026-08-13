import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  fullyParallel: false,
  workers: 1,
  use: {
    viewport: { width: 1280, height: 720 },
    trace: "off",
  },
});
