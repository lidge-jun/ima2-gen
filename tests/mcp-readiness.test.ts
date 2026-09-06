import assert from "node:assert/strict";
import test from "node:test";
import { deriveMcpReadiness, parseMcpReadinessData, type McpReadinessObservation, type McpReadinessSelection } from "../ui/src/lib/mcpReadiness";

const selection = { provider: "runway", model: "image-a", kind: "image" as const };
const provider = (extra: Record<string, unknown> = {}) => ({ id: "runway", enabled: true, status: { state: "connected" as const }, ...extra });
const catalog = (image: unknown[] = [{ id: "image-a", label: "Image A" }], video: unknown[] = [{ id: "image-a", label: "Video A" }]) => ({ ok: true, models: { image, video } });
const observation = (overrides: Partial<McpReadinessObservation> = {}): McpReadinessObservation => ({ selection, phase: "ready", observedAt: 123, providers: [{ id: "runway", enabled: true, status: { state: "connected" } }], catalog: { image: [{ id: "image-a", label: "Image A" }], video: [{ id: "image-a", label: "Video A" }] }, ...overrides });

test("readiness projection covers every ordered code", () => {
  const cases: Array<[string, McpReadinessObservation, McpReadinessSelection]> = [
    ["loading", observation({ phase: "loading" }), selection], ["error", observation({ phase: "error" }), selection],
    ["missing", observation({ providers: [] }), selection], ["disabled", observation({ providers: [{ ...provider(), enabled: false }] }), selection],
    ["disconnected", observation({ providers: [{ ...provider(), status: { state: "offline" } }] }), selection],
    ["locked", observation({ providers: [{ ...provider(), executable: false }] }), selection],
    ["default", observation({ selection: { ...selection, model: null } }), { ...selection, model: null }], ["model-missing", observation({ catalog: { image: [], video: [] } }), selection],
    ["model-locked", observation({ catalog: { image: [{ id: "image-a", label: "Image A", executable: false }], video: [] } }), selection], ["ready", observation(), selection],
  ];
  for (const [expected, current, picked] of cases) assert.equal(deriveMcpReadiness(current, picked).code, expected);
});
test("same model ID is distinguished by media kind and null is the provider default", () => {
  const automatic = { ...selection, model: null };
  const video = { ...selection, kind: "video" as const };
  assert.equal(deriveMcpReadiness(observation({ selection: automatic }), automatic).code, "default");
  assert.equal(deriveMcpReadiness(observation({ selection: video }), video).modelLabel, "Video A");
});
test("stale selections and stale error data never become ready", () => {
  assert.equal(deriveMcpReadiness(observation({ selection: { ...selection, kind: "video" } }), selection).code, "loading");
  assert.equal(deriveMcpReadiness(observation({ phase: "error", catalog: { image: [{ id: "image-a", label: "Image A" }], video: [] } }), selection).code, "error");
});
test("parser requires strict consumed envelopes and ignores extras", () => {
  const parsed = parseMcpReadinessData({ ok: true, providers: [{ ...provider(), authorizationUrl: "secret", extra: true }] }, catalog());
  assert.deepEqual(parsed.providers[0], { id: "runway", enabled: true, status: { state: "connected" } });
  for (const bad of [{ ok: false, providers: [] }, { ok: true, providers: [{ id: "runway", enabled: true }] }]) assert.throws(() => parseMcpReadinessData(bad, null), /MCP_READINESS_INVALID/);
});
test("model labels fall back to the raw model ID", () => {
  const current = observation({ catalog: { image: [{ id: "image-a", label: "" }], video: [] } });
  assert.equal(deriveMcpReadiness(current, selection).modelLabel, "image-a");
});
