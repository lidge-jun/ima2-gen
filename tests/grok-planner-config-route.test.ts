import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { registerCapabilitiesRoutes } from "../routes/capabilities.ts";

let server: Server | undefined;

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  server = undefined;
});

async function startApp() {
  const app = express();
  app.use(express.json());
  registerCapabilitiesRoutes(app, {
    config: { grokProvider: { plannerModel: "grok-4.3" } },
  });
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

test("Grok planner config defaults to 4.3 and preserves the 4.6 override", async () => {
  const base = await startApp();
  const initial = await fetch(`${base}/api/config/grok-planner`);
  const initialBody = await initial.json() as { model: string; options: string[] };
  assert.equal(initial.status, 200);
  assert.equal(initialBody.model, "grok-4.3");
  assert.equal(initialBody.options[0], "grok-4.3");
  assert.ok(initialBody.options.includes("grok-4.6"));

  const compatible = await fetch(`${base}/api/config/grok-planner`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "grok-4.6" }),
  });
  assert.equal(compatible.status, 200);
  assert.deepEqual(await compatible.json(), { model: "grok-4.6" });

  const invalid = await fetch(`${base}/api/config/grok-planner`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "grok-9.9" }),
  });
  assert.equal(invalid.status, 400);
});
