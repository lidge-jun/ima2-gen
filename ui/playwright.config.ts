import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  fullyParallel: false,
  workers: 1,
  projects: [
    { name: "isolation", testMatch: "fixture-isolation.spec.ts" },
    { name: "journeys", testIgnore: "fixture-isolation.spec.ts", dependencies: ["isolation"] },
  ],
  use: {
    serviceWorkers: "block",
    viewport: { width: 1280, height: 720 },
    trace: "off",
  },
});
