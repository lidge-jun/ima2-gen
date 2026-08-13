import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const { resolveErrorSpec } = await import("../ui/src/lib/errorCodes.ts");
const { parseSseErrorPayload } = await import("../ui/src/lib/sseStreamError.ts");
const { jsonFetch } = await import("../ui/src/lib/api-core.ts");
const { agentQueueErrorLabel, resolveAgentQueueError } = await import("../ui/src/lib/agentQueueError.ts");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ko = JSON.parse(readFileSync(resolve(root, "ui/src/i18n/ko.json"), "utf8")) as {
  errorCard: Record<string, { title?: string }>;
};
function source(rel: string): string {
  return readFileSync(resolve(root, rel), "utf8");
}
function koTitle(cardKey: string): string {
  const leaf = cardKey.split(".").pop() as string;
  return ko.errorCard[leaf]?.title ?? "";
}

const billingPayload = {
  code: "INVALID_REQUEST",
  rawCode: "MINIMAX_INSUFFICIENT_BALANCE",
  errorClass: "BILLING_REQUIRED",
  message: "ordinary provider failure",
};

describe("063 error UI consumption", () => {
  it("priority class beats a registered app code and the cardKey survives the store", () => {
    const resolved = resolveErrorSpec(billingPayload);
    assert.equal(resolved.spec.cardKey, "errorCard.billingRequired");
    assert.equal(resolved.rawCode, "MINIMAX_INSUFFICIENT_BALANCE");
    assert.equal(resolved.errorClass, "BILLING_REQUIRED");
    assert.equal(koTitle(resolved.spec.cardKey ?? ""), "잔액이 부족합니다");
    assert.match(source("ui/src/lib/errorHandler.ts"), /cardKey: spec\.cardKey/);
    assert.match(source("ui/src/store/storeUIImpl.ts"), /cardKey: params\?\.cardKey/);
    assert.match(source("ui/src/components/Toast.tsx"), /card\.cardKey \?\? spec\?\.cardKey/);
    assert.doesNotMatch(source("ui/src/components/Toast.tsx"), /errorCodes\[card\.code\] \?\? errorCodes\.UNKNOWN/);
  });

  it("code-only INVALID_REQUEST keeps the existing card", () => {
    const resolved = resolveErrorSpec({ code: "INVALID_REQUEST", message: "bad size" });
    assert.equal(resolved.spec.cardKey, "errorCard.invalidRequest");
    assert.equal("errorClass" in resolved, false);
  });

  it("registered app codes keep their spec even with a dummy class", () => {
    const resolved = resolveErrorSpec({ code: "SAFETY_REFUSAL", errorClass: "NETWORK_FAILURE", message: "blocked" });
    assert.equal(resolved.spec.cardKey, "errorCard.moderationRefused");
    assert.equal(resolved.spec.surface, "card");
  });

  it("SSE parser keeps fields and prefers the nested envelope", () => {
    const flat = parseSseErrorPayload({
      error: "ordinary provider failure",
      code: "INVALID_REQUEST",
      rawCode: "MINIMAX_INSUFFICIENT_BALANCE",
      errorClass: "BILLING_REQUIRED",
    });
    assert.equal(flat.rawCode, "MINIMAX_INSUFFICIENT_BALANCE");
    assert.equal(flat.errorClass, "BILLING_REQUIRED");
    const nested = parseSseErrorPayload({
      error: { code: "INVALID_REQUEST", message: "nested", rawCode: "NESTED_RAW", errorClass: "AUTH_EXPIRED" },
      code: "IGNORED_CODE",
      rawCode: "FLAT_RAW",
      errorClass: "NETWORK_FAILURE",
    });
    assert.equal(nested.code, "INVALID_REQUEST");
    assert.equal(nested.rawCode, "NESTED_RAW");
    assert.equal(nested.errorClass, "AUTH_EXPIRED");
  });

  it("jsonFetch preserves Edit JSON envelope fields", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({
      error: "ordinary provider failure",
      code: "INVALID_REQUEST",
      rawCode: "MINIMAX_INSUFFICIENT_BALANCE",
      errorClass: "BILLING_REQUIRED",
    }), { status: 402, headers: { "Content-Type": "application/json" } });
    try {
      await jsonFetch("/api/edit");
      assert.fail("jsonFetch should throw");
    } catch (error) {
      const err = error as Error & { rawCode?: string; errorClass?: string; code?: string };
      assert.equal(err.code, "INVALID_REQUEST");
      assert.equal(err.rawCode, "MINIMAX_INSUFFICIENT_BALANCE");
      assert.equal(err.errorClass, "BILLING_REQUIRED");
      assert.equal(resolveErrorSpec(err).spec.cardKey, "errorCard.billingRequired");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("unknown classes fall back to the message heuristic", () => {
    const resolved = resolveErrorSpec({ errorClass: "NOT_A_CLASS", message: "no image data returned" });
    assert.equal(resolved.code, "EMPTY_RESPONSE");
    assert.equal(resolved.spec.cardKey, "errorCard.emptyResponse");
    assert.equal("errorClass" in resolved, false);
  });

  it("Agent helper renders class wording and keeps the raw code", () => {
    const item = {
      errorCode: "ATLASCLOUD_GENERATE_FAILED",
      errorClass: "BILLING_REQUIRED",
      errorMessage: "ordinary provider failure",
    };
    const resolved = resolveAgentQueueError(item);
    const label = agentQueueErrorLabel(resolved, (key) => {
      if (key.startsWith("errorCard.")) return koTitle(key.replace(/\.title$/, ""));
      return key;
    });
    assert.equal(label, "잔액이 부족합니다");
    assert.equal(item.errorCode, "ATLASCLOUD_GENERATE_FAILED");
    assert.match(source("ui/src/components/agent/AgentQueueRow.tsx"), /agentQueueErrorLabel\(resolveAgentQueueError\(item\), t\)/);
    const timeout = resolveAgentQueueError({ errorCode: "timeout", errorMessage: "timeout" });
    assert.equal(agentQueueErrorLabel(timeout, () => "x"), null);
  });
});
