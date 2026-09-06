// Contract test for the 010 MCP schema spike sanitizer (WP1).
// Intentionally classified as a contract test in the inventory: it imports from
// scripts/lib (not lib/routes/bin), which classify-tests.mjs treats as non-runtime.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// eslint-disable-next-line import/no-relative-packages
import { scrub, sha, denyMutations } from "../scripts/lib/spikeSanitize.mjs";

test("scrub removes long opaque tokens", () => {
  const token = "sk_live_" + "a1B2c3D4e5F6g7H8i9J0".repeat(3);
  const out = scrub({ description: `use ${token} here` }) as { description: string };
  assert.ok(!out.description.includes(token));
  assert.match(out.description, /\[REDACTED\]/);
});

test("scrub removes emails and signed query params", () => {
  const out = scrub({
    a: "contact user@example.com now",
    b: "https://cdn.example.com/file.mp4?sig=abc123def&x=1",
  }) as { a: string; b: string };
  assert.ok(!out.a.includes("user@example.com"));
  assert.ok(!out.b.includes("sig=abc123def"));
});

test("scrub preserves nested schema structure", () => {
  const schema = { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"] };
  assert.deepEqual(scrub(schema), schema);
});

test("sha is deterministic and prefixed", () => {
  assert.equal(sha({ a: 1 }), sha({ a: 1 }));
  assert.match(sha({ a: 1 }), /^sha256:[0-9a-f]{64}$/);
});

test("auxiliary OAuth callback returns untrusted error text as nosniff plain text", () => {
  // Do not import the executable spike: that would load account state and connect.
  const source = readFileSync(new URL("../scripts/mcp-schema-spike.mjs", import.meta.url), "utf8");
  const callback = source.slice(source.indexOf("function waitForCallback()"), source.indexOf("async function connectOnce()"));
  assert.match(callback, /"content-type": "text\/plain; charset=utf-8"/);
  assert.match(callback, /"x-content-type-options": "nosniff"/);
  assert.doesNotMatch(callback, /text\/html|<h2>/);
});

test("denyMutations blocks callTool/readResource/getPrompt with MCP_SPIKE_MUTATION_DENIED", () => {
  const client = denyMutations({} as Record<string, () => void>);
  for (const m of ["callTool", "readResource", "getPrompt"] as const) {
    assert.throws(() => (client as Record<string, () => void>)[m](), /MCP_SPIKE_MUTATION_DENIED/);
  }
});
