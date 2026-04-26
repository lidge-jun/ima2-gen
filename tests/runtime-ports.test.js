import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:net";
import {
  findAvailablePort,
  getServerPort,
  listenWithPortFallback,
  parseLocalhostPortFromUrl,
  parseOAuthReadyUrl,
} from "../lib/runtimePorts.js";

function occupy(port) {
  return new Promise((resolve) => {
    const server = createServer().listen(port, "127.0.0.1", () => resolve(server));
  });
}

test("findAvailablePort skips occupied preferred port", async () => {
  const base = 3900 + Math.floor(Math.random() * 400);
  const blocker = await occupy(base);
  try {
    const port = await findAvailablePort(base, { host: "127.0.0.1", maxAttempts: 2 });
    assert.equal(port, base + 1);
  } finally {
    await new Promise((resolve) => blocker.close(resolve));
  }
});

test("listenWithPortFallback binds the next available port", async () => {
  const base = 4300 + Math.floor(Math.random() * 400);
  const blocker = await occupy(base);
  const app = express();
  try {
    const server = await listenWithPortFallback(app, base, {
      host: "127.0.0.1",
      maxAttempts: 2,
      label: "test-server",
    });
    assert.equal(getServerPort(server), base + 1);
    await new Promise((resolve) => server.close(resolve));
  } finally {
    await new Promise((resolve) => blocker.close(resolve));
  }
});

test("OAuth ready URL parser returns actual fallback port", () => {
  const url = parseOAuthReadyUrl("OpenAI-compatible endpoint ready at http://127.0.0.1:10532/v1");
  assert.equal(url, "http://127.0.0.1:10532");
  assert.equal(parseLocalhostPortFromUrl(url), 10532);
});
