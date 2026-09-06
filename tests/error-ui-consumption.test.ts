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

const grokKeyCopy = {
  en: { title: "Grok API key required", body: "Add an xAI API key in Settings > Providers, then retry. This image request will not fall back to the Grok proxy.", cta: "Open provider settings" },
  ko: { title: "Grok API 키가 필요합니다", body: "설정 > 제공자에서 xAI API 키를 추가한 뒤 다시 시도하세요. 이 이미지 요청은 Grok 프록시로 전환되지 않습니다.", cta: "제공자 설정 열기" },
  "zh-Hans": { title: "需要 Grok API 密钥", body: "请在设置 > 提供商中添加 xAI API 密钥，然后重试。此图像请求不会回退到 Grok 代理。", cta: "打开提供商设置" },
  "zh-Hant": { title: "需要 Grok API 金鑰", body: "請在設定 > 供應商中新增 xAI API 金鑰，然後重試。此圖像請求不會改用 Grok 代理。", cta: "開啟供應商設定" },
};

describe("WP03 Grok image key guidance", () => {
  it("flat 401 JSON reaches the dedicated card without synthetic decoration", async () => {
    const original = globalThis.fetch;
    const payload = { error: "Grok API key is required for grok-api image generation",
      code: "GROK_API_KEY_MISSING", requestId: "wp03-flat-key" };
    globalThis.fetch = async () => new Response(JSON.stringify(payload), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
    try {
      await assert.rejects(jsonFetch("/api/generate"), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as Error & { status?: number }).status, 401);
        const resolved = resolveErrorSpec(error);
        assert.equal(resolved.code, "GROK_API_KEY_MISSING");
        assert.equal(resolved.message, payload.error);
        assert.equal(resolved.rawCode, undefined);
        assert.equal(resolved.errorClass, undefined);
        assert.deepEqual(resolved.spec, { surface: "card", cardKey: "errorCard.grokApiKeyMissing", cta: "reauth" });
        return true;
      });
    } finally { globalThis.fetch = original; }
  });

  it("dedicated code and rawCode fallback both outrank generic AUTH_INVALID", () => {
    for (const code of ["GROK_API_KEY_MISSING", "UNREGISTERED_WRAPPER"]) {
      const resolved = resolveErrorSpec({ code, rawCode: "GROK_API_KEY_MISSING",
        errorClass: "AUTH_INVALID", message: "ordinary provider failure" });
      assert.equal(resolved.code, "GROK_API_KEY_MISSING");
      assert.equal(resolved.rawCode, "GROK_API_KEY_MISSING");
      assert.equal(resolved.errorClass, "AUTH_INVALID");
      assert.deepEqual(resolved.spec, { surface: "card", cardKey: "errorCard.grokApiKeyMissing", cta: "reauth" });
    }
  });

  it("flat and nested stream consumers preserve missing-key guidance", () => {
    for (const error of ["key missing", { code: "GROK_API_KEY_MISSING", message: "key missing" }]) {
      const parsed = parseSseErrorPayload({ error, code: "GROK_API_KEY_MISSING", status: 401 });
      assert.equal(parsed.code, "GROK_API_KEY_MISSING");
      assert.equal(parsed.status, 401);
      assert.equal(resolveErrorSpec(parsed).spec.cardKey, "errorCard.grokApiKeyMissing");
    }
  });

  for (const [locale, expected] of Object.entries(grokKeyCopy)) {
    it(`${locale} has exact image-only key-setting copy`, () => {
      const dictionary = JSON.parse(source(`ui/src/i18n/${locale}.json`));
      assert.deepEqual(dictionary.errorCard.grokApiKeyMissing, expected);
    });
  }
});

it("WP03 actual J6 interception keeps flat refusals scoped and default 202 unchanged", async () => {
  const { installJ6SelectionCapture } = await import("../ui/e2e/fixtures/j6Selection.ts");
  type Capture = Awaited<ReturnType<typeof installJ6SelectionCapture>>;
  let handler: ((route: unknown) => Promise<void>) | undefined;
  let disposed = false;
  // A protocol-only context double: no Playwright browser, socket, app, or auth probe.
  const context = { pages: () => [], serviceWorkers: () => [],
    route: async (_pattern: string, callback: typeof handler) => { handler = callback; },
    unroute: async (_pattern: string, callback: typeof handler) => { assert.equal(callback, handler); disposed = true; } };
  const capture = await installJ6SelectionCapture(context as unknown as Parameters<typeof installJ6SelectionCapture>[0], "http://127.0.0.1:40123");
  const cases: Array<{ failure?: Capture["submissionFailure"]; provider: string; path: string; status: number; code?: string; error?: string }> = [
    { provider: "grok-api", path: "/api/generate", status: 202 },
    { failure: "grok-api-key-missing", provider: "grok-api", path: "/api/generate", status: 401,
      code: "GROK_API_KEY_MISSING", error: "Grok API key is required for grok-api image generation" },
    { failure: "grok-api-key-missing", provider: "grok", path: "/api/generate", status: 202 },
    { failure: "grok-api-key-missing", provider: "grok-api", path: "/api/video/generate", status: 202 },
    { failure: "oauth-unavailable", provider: "oauth", path: "/api/generate", status: 503,
      code: "OAUTH_UNAVAILABLE", error: "OAuth proxy unavailable" },
    { failure: "oauth-unavailable", provider: "api", path: "/api/generate", status: 202 },
    { failure: "invalid-request", provider: "api", path: "/api/generate", status: 400,
      code: "INVALID_REQUEST", error: "Invalid size for image generation" },
    { failure: "invalid-request", provider: "oauth", path: "/api/generate", status: 202 },
  ];
  try {
    assert.ok(handler);
    for (const [index, fixture] of cases.entries()) {
      if (fixture.failure) capture.submissionFailure = fixture.failure;
      else delete capture.submissionFailure;
      const requestId = `wp03-j6-${index}`;
      const replies: unknown[] = [];
      await handler({ request: () => ({ url: () => `http://127.0.0.1:40123${fixture.path}`,
        method: () => "POST", postDataJSON: () => ({ provider: fixture.provider, async: true, requestId }) }),
        fulfill: async (reply: unknown) => { replies.push(reply); },
        abort: async () => { assert.fail("valid fixture submission must not abort"); },
        continue: async () => { assert.fail("submission must never reach a real handler"); } });
      const json = fixture.code ? { error: fixture.error, code: fixture.code, requestId } : { requestId };
      assert.deepEqual(replies, [{ status: fixture.status, json }]);
    }
    assert.equal(capture.requests.length, cases.length);
    assert.deepEqual(capture.unexpected, []);
  } finally { await capture.dispose(); }
  assert.equal(disposed, true);
});

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
