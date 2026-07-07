import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(path) {
  return readFileSync(path, "utf-8");
}

test("account settings renders an OpenAI API base URL control near API keys", () => {
  const account = read("ui/src/components/AccountSettings.tsx");

  assert.match(account, /ApiBaseUrlInput/);
  assert.match(account, /keyStatus\.openaiBaseUrl/);
});

test("OpenAI API base URL control reads status, saves, and restores via config route", () => {
  const component = read("ui/src/components/ApiBaseUrlInput.tsx");

  assert.match(component, /\/api\/config\/api-provider\/base-url/);
  assert.match(component, /method:\s*"PUT"/);
  assert.match(component, /method:\s*"DELETE"/);
  assert.match(component, /settings\.apiKeys\.openaiBaseUrl\.label/);
  assert.match(component, /settings\.apiKeys\.openaiBaseUrl\.placeholder/);
});

test("API key status type includes OpenAI base URL metadata", () => {
  const hook = read("ui/src/hooks/useKeyStatus.ts");

  assert.match(hook, /openaiBaseUrl/);
  assert.match(hook, /defaultValue:\s*string/);
  assert.match(hook, /custom:\s*boolean/);
});
