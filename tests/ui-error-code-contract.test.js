import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("UI maps proxy and network errors to card surfaces", () => {
  const source = readFileSync("ui/src/lib/errorCodes.ts", "utf-8");
  assert.match(source, /NETWORK_FAILED:\s*\{ surface: "card", cardKey: "errorCard\.networkFailed"/);
  assert.match(source, /OAUTH_UNAVAILABLE:\s*\{ surface: "card", cardKey: "errorCard\.oauthUnavailable"/);
  assert.match(source, /INVALID_REQUEST:\s*\{ surface: "card", cardKey: "errorCard\.invalidRequest"/);
  assert.match(source, /EMPTY_RESPONSE:\s*\{ surface: "card", cardKey: "errorCard\.emptyResponse"/);
  assert.match(source, /invalid_value/);
  assert.match(source, /minimum pixel budget/);
  assert.doesNotMatch(source, /content generation refused[^}]+MODERATION_REFUSED/s);
});

test("node API preserves status on JSON and SSE errors", () => {
  const source = readFileSync("ui/src/lib/nodeApi.ts", "utf-8");
  assert.match(source, /export type NodeErrorResponse = \{[\s\S]*status\?: number;/);
  assert.match(source, /e\.status = err\?\.status \?\? res\.status;/);
  assert.match(source, /e\.status = err\?\.status;/);
});

test("invalid request and open-folder feedback i18n keys exist", () => {
  const en = readFileSync("ui/src/i18n/en.json", "utf-8");
  const ko = readFileSync("ui/src/i18n/ko.json", "utf-8");
  assert.match(en, /"openGeneratedDirOpened"/);
  assert.match(ko, /"openGeneratedDirOpened"/);
  assert.match(en, /"invalidRequest"/);
  assert.match(ko, /"invalidRequest"/);
  assert.match(en, /"emptyResponse"/);
  assert.match(ko, /"emptyResponse"/);
});
