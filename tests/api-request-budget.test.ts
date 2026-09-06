import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import { createApiRequestBudget, isApiRequestPath } from "../lib/apiRequestBudget.ts";

const policy = { windowMs: 60_000, requests: 6, mutations: 2, maxPeers: 2 };
type Budget = ReturnType<typeof createApiRequestBudget>;

function request(budget: Budget, options: { path?: string; method?: string; peer?: string; forwarded?: string } = {}) {
  const result = { admitted: false, status: 200, retry: "", code: "" };
  const req = {
    path: options.path ?? "/api/generate", method: options.method ?? "GET",
    socket: { remoteAddress: options.peer ?? "192.0.2.10" },
    headers: { "x-forwarded-for": options.forwarded },
  } as unknown as Request;
  const res = {
    setHeader(name: string, value: string) { assert.equal(name, "Retry-After"); result.retry = value; },
    status(status: number) { result.status = status; return this; },
    json(body: { error: { code: string } }) { result.code = body.error.code; return this; },
  } as unknown as Response;
  budget(req, res, () => { result.admitted = true; });
  return result;
}

test("API matching follows case-insensitive segment boundaries", () => {
  for (const path of ["/api", "/API", "/api/health", "/API/health", "/Api/health"]) {
    assert.equal(isApiRequestPath(path), true, path);
  }
  for (const path of ["/", "/apix/health", "/APIx", "/generated/result.png"]) {
    assert.equal(isApiRequestPath(path), false, path);
  }
});

test("mutation budget rejects before next, does not spend remaining read allowance, and expires", () => {
  let now = 0;
  const budget = createApiRequestBudget(policy, () => now);
  assert.equal(request(budget, { method: "POST" }).admitted, true);
  assert.equal(request(budget, { method: "DELETE", path: "/API/item" }).admitted, true);
  const denied = request(budget, { method: "PUT" });
  assert.deepEqual(denied, { admitted: false, status: 429, retry: "60", code: "API_RATE_LIMITED" });
  assert.equal(request(budget, { method: "GET" }).admitted, true);
  now = 59_999;
  assert.equal(request(budget, { method: "POST" }).retry, "1");
  now = 60_000;
  assert.equal(request(budget, { method: "POST" }).admitted, true);
});

test("total allowance counts API connection requests, ignores forwarded identity and static paths", () => {
  const budget = createApiRequestBudget(policy, () => 0);
  for (let i = 0; i < policy.requests; i++) {
    assert.equal(request(budget, { path: "/api/events", forwarded: `198.51.100.${i}` }).admitted, true);
  }
  assert.equal(request(budget, { method: "HEAD", forwarded: "another-peer" }).status, 429);
  assert.equal(request(budget, { method: "OPTIONS" }).status, 429);
  assert.equal(request(budget, { path: "/apix/events" }).admitted, true);
  assert.equal(request(budget, { path: "/generated/result.png" }).admitted, true);
  assert.equal(request(budget, { peer: "192.0.2.11" }).admitted, true);
});

test("full peer table refuses new identities without evicting active limits, then prunes expiry", () => {
  let now = 0;
  const budget = createApiRequestBudget(policy, () => now);
  assert.equal(request(budget, { peer: "one", method: "POST" }).admitted, true);
  assert.equal(request(budget, { peer: "one", method: "POST" }).admitted, true);
  now = 500;
  assert.equal(request(budget, { peer: "two" }).admitted, true);
  assert.equal(request(budget, { peer: "three" }).status, 429);
  assert.equal(request(budget, { peer: "one", method: "POST" }).status, 429);
  now = 60_000;
  assert.equal(request(budget, { peer: "three" }).admitted, true);
  assert.equal(request(budget, { peer: "four" }).status, 429);
  now = 60_500;
  assert.equal(request(budget, { peer: "four" }).admitted, true);
});

test("budgets belong to each app, and a 24-way generation burst fits configured design", () => {
  const first = createApiRequestBudget(policy, () => 0);
  const second = createApiRequestBudget(policy, () => 0);
  for (let i = 0; i < policy.requests; i++) request(first);
  assert.equal(request(first).status, 429);
  assert.equal(request(second).admitted, true);
  const burst = createApiRequestBudget({ ...policy, requests: 600, mutations: 120 }, () => 0);
  for (let i = 0; i < 24; i++) {
    assert.equal(request(burst, { method: "POST" }).admitted, true);
    assert.equal(request(burst, { path: "/api/jobs/status" }).admitted, true);
  }
});
