import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import {
  buildNodeErrorInfo,
  nodeRetryAction,
  type NodeRetryAction,
} from "../ui/src/lib/nodeErrorInfo.ts";
import { errorCodes, type ImaErrorCode } from "../ui/src/lib/errorCodes.ts";

/** Expected inline-node action for every registry code (wp2 audit blocker #1). */
const EXPECTED: Record<ImaErrorCode, NodeRetryAction> = {
  REF_TOO_LARGE: "fix-input",
  REF_NOT_BASE64: "fix-input",
  REF_EMPTY: "fix-input",
  REF_TOO_MANY: "fix-input",
  MINIMAX_MODEL_REQUIRES_REFERENCE: "fix-input",
  MODERATION_REFUSED: "fix-input",
  SAFETY_REFUSAL: "fix-input",
  EMPTY_RESPONSE: "retry",
  STREAM_PARSE_FAILED: "retry",
  IMAGE_TOOL_NOT_CALLED: "retry",
  WEB_SEARCH_ONLY_RESPONSE: "retry",
  IMAGE_TOOL_FAILED: "retry",
  IMAGE_TOOL_COMPLETED_WITHOUT_RESULT: "retry",
  OAUTH_IMAGE_CAPABILITY_UNAVAILABLE: "fix-input",
  RESPONSES_STREAM_ERROR: "retry",
  UPSTREAM_5XX: "retry",
  AUTH_CHATGPT_EXPIRED: "auth",
  AUTH_API_KEY_INVALID: "auth",
  NETWORK_FAILED: "retry",
  OAUTH_UNAVAILABLE: "retry",
  INVALID_REQUEST: "fix-input",
  INVALID_MODERATION: "fix-input",
  APIKEY_DISABLED: "auth",
  AGY_GENERATION_FAILED: "retry",
  AGY_TIMEOUT: "retry",
  AGY_PROCESS_ERROR: "retry",
  AGY_QUOTA_EXHAUSTED: "auth",
  AGY_PARSE_FAILED: "retry",
  AGY_ARTIFACT_NOT_FOUND: "retry",
  DB_ERROR: "retry",
  UNKNOWN: "retry",
};

describe("node error info contracts", () => {
  it("EI-00 exhaustively maps every registry code to the audited action", () => {
    for (const code of Object.keys(errorCodes) as ImaErrorCode[]) {
      assert.equal(nodeRetryAction(code), EXPECTED[code], `action mismatch for ${code}`);
    }
  });

  it("EI-01 moderation refusal is not retryable", () => {
    const err = Object.assign(new Error("moderation refused"), { code: "MODERATION_REFUSED" });
    const info = buildNodeErrorInfo(err);
    assert.equal(info.code, "MODERATION_REFUSED");
    assert.equal(info.retryable, false);
    assert.equal(info.action, "fix-input");
  });

  it("EI-02 network-class failures are retryable via message classification", () => {
    const info = buildNodeErrorInfo(new Error("fetch failed: ECONNRESET"));
    assert.equal(info.code, "NETWORK_FAILED");
    assert.equal(info.retryable, true);
    assert.equal(info.action, "retry");
  });

  it("EI-03 expired ChatGPT auth points to auth remediation", () => {
    const info = buildNodeErrorInfo(new Error("Your token is expired, sign in again"));
    assert.equal(info.code, "AUTH_CHATGPT_EXPIRED");
    assert.equal(info.action, "auth");
    assert.equal(info.retryable, false);
  });

  it("EI-03b registry consistency: auth actions only for reauth/account codes", () => {
    for (const code of Object.keys(errorCodes) as ImaErrorCode[]) {
      const action = nodeRetryAction(code);
      if (errorCodes[code].cta === "reauth") assert.equal(action, "auth");
      if (action === "retry") assert.equal(buildNodeErrorInfo(Object.assign(new Error("x"), { code })).retryable, true);
    }
  });

  it("EI-04 store wires errorInfo through failure, success, and cancel paths", () => {
    const store = readFileSync("ui/src/store/storeNodeGenImpl.ts", "utf-8");
    assert.match(store, /errorInfo: buildNodeErrorInfo\(err\)/);
    const resets = store.match(/errorInfo: null/g) ?? [];
    assert.ok(resets.length >= 3, `expected >=3 errorInfo resets, saw ${resets.length}`);
  });

  it("EI-05 image node renders code-aware retry and CTA affordances", () => {
    const node = readFileSync("ui/src/components/ImageNode.tsx", "utf-8");
    assert.match(node, /errorAction === "retry"/);
    assert.match(node, /onClick=\{onRegenerateInPlace\}/);
    assert.match(node, /t\("node\.errorAuthCta"\)/);
    assert.match(node, /t\("node\.errorFixCta"\)/);
  });

  it("EI-06 i18n carries the retry and CTA keys in both locales", () => {
    for (const locale of ["en", "ko"]) {
      const dict = JSON.parse(readFileSync(`ui/src/i18n/${locale}.json`, "utf-8"));
      for (const key of ["retry", "retryTitle", "errorAuthCta", "errorFixCta"]) {
        assert.equal(typeof dict.node[key], "string", `${locale} node.${key}`);
      }
      assert.equal(typeof dict.nodeBatch.partialFinished, "string");
    }
  });
});
