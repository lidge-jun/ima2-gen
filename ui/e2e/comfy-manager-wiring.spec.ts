import { expect, test } from "@playwright/test";
import { observeManager, preflightManager, withManager } from "./fixtures/comfyManagerHarness";
import type { ManagerScenario } from "./fixtures/comfyManagerComponent";

test.beforeAll(async ({}, info) => { await preflightManager(info); });
const GRAPH = { "1": { class_type: "CLIPTextEncode", inputs: { text: "cedar" } }, "2": { class_type: "SaveImage", inputs: {} } };
const SCENARIOS: ManagerScenario[] = ["create-success", "create-failure", "delete-success", "delete-failure", "create-catalog-error"];
for (const scenario of SCENARIOS) {
  test(`actual Manager ${scenario}: shared observation follows only successful writes`, async ({ browser }, info) => {
    await withManager(browser, info, scenario, async (fixture) => {
      const { page } = fixture;
      const initial = await observeManager(fixture, "initial");
      expect(initial.sameSnapshot).toBe(true);
      expect(initial.calls.map(({ method, path }) => [method, path]).sort())
        .toEqual([["GET", "/api/comfy/workflows"], ["GET", "/api/models"]].sort());
      const creating = scenario.startsWith("create"), failing = scenario.endsWith("failure");
      if (creating) {
        await page.locator("#comfy-file").setInputFiles({ name: "cedar-a.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(GRAPH)) });
        await expect(page.locator("#comfy-id")).toHaveValue("cedar-a");
        await page.locator("#comfy-label").fill("Cedar");
        const submit = page.getByRole("button", { name: "Register", exact: true });
        await expect(submit).toBeEnabled(); await submit.click();
      } else {
        await page.getByRole("button", { name: "Remove", exact: true }).click();
      }
      await expect.poll(async () => (await page.evaluate(() => window.wp08c.snapshot())).pending).toBe(true);
      const held = await observeManager(fixture, "write-held");
      expect(held.calls.filter((call) => call.path === "/api/models")).toHaveLength(1);
      expect(held.calls.filter((call) => call.path === "/api/comfy/workflows" && call.method === "GET")).toHaveLength(1);
      expect(held.resource).toEqual(initial.resource);
      await page.evaluate(() => window.wp08c.release());
      await expect.poll(async () => (await page.evaluate(() => window.wp08c.snapshot())).calls.filter((call) => call.outcome === "pending").length).toBe(0);
      if (failing) await expect(page.getByRole("alert")).toHaveText("Synthetic write rejected");
      else {
        await expect.poll(async () => (await page.evaluate(() => window.wp08c.snapshot())).calls.filter((call) => call.path === "/api/models").length).toBe(2);
        await expect(page.locator("#a")).toHaveAttribute("data-phase", scenario === "create-catalog-error" ? "error" : "ready");
        await expect(page.locator("#b")).toHaveAttribute("data-phase", scenario === "create-catalog-error" ? "error" : "ready");
        await expect(page.getByRole("alert")).toHaveCount(0);
        if (creating) await expect(page.locator("#comfy-id")).toHaveCount(0);
      }
      const final = await observeManager(fixture, "settled");
      expect(final.violations).toEqual([]); expect(final.sameSnapshot).toBe(true);
      expect(final.first).toBe(final.second);
      expect(final.calls.filter((call) => call.path === "/api/models")).toHaveLength(failing ? 1 : 2);
      expect(final.calls.filter((call) => call.path === "/api/comfy/workflows" && call.method === "GET")).toHaveLength(failing ? 1 : 2);
      expect(final.calls.filter((call) => call.method === (creating ? "POST" : "DELETE")
        && call.path !== "/api/comfy/inspect")).toHaveLength(1);
      expect(final.workflows.map((row) => row.id)).toEqual(creating ? failing ? [] : ["cedar-a"] : failing ? ["cedar-a"] : []);
      if (failing) expect(final.resource).toEqual(initial.resource);
      else if (scenario === "create-catalog-error") {
        expect(final.resource.phase).toBe("error"); expect(final.resource.error).toBe("request");
        expect(final.resource.catalog).toEqual(initial.resource.catalog);
        expect(final.resource.observedAt).toBe(initial.resource.observedAt);
      } else {
        expect(final.resource.phase).toBe("ready");
        expect(final.resource.catalog?.comfy.models.image.map((row) => row.id)).toEqual(creating ? ["cedar-a"] : []);
      }
    });
  });
}
