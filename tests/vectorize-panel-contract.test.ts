import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const panel = readFileSync("ui/src/components/assetgen/VectorizePanel.tsx", "utf8");
const lightbox = readFileSync("ui/src/components/assetgen/AssetMediaLightbox.tsx", "utf8");
const api = readFileSync("ui/src/lib/api-assets.ts", "utf8");

test("unchanged advanced knobs are omitted so the tuned preset survives", () => {
  // Regression: the panel used to always send its slider defaults, which the server
  // counts as an override. The same asset then traced 9430 paths through the UI
  // versus 722 through the API at the identical preset.
  assert.match(panel, /colorPrecision !== DEFAULTS\.colorPrecision \? \{ colorPrecision \} : \{\}/);
  assert.match(panel, /filterSpeckle !== DEFAULTS\.filterSpeckle \? \{ filterSpeckle \} : \{\}/);
  assert.match(panel, /cornerThreshold !== DEFAULTS\.cornerThreshold \? \{ cornerThreshold \} : \{\}/);
});

test("an existing vector is never offered for re-tracing", () => {
  assert.match(lightbox, /const canVectorize = !isVideo && Boolean\(item\.filename\) && !\/\\\.svg\$\/i\.test\(item\.filename \?\? ""\)/);
  assert.match(lightbox, /canVectorize \? \(/);
});

test("the vectorize request targets the vector-svg derived kind without a body", () => {
  const request = api.slice(api.indexOf("export async function requestVectorize"));
  assert.match(api, /params\.set\("kind", "vector-svg"\)/);
  assert.match(request, /method: "POST"/);
  assert.doesNotMatch(request.slice(0, request.indexOf("\n}")), /body:/);
});

test("closing a running trace aborts the client wait and HTTP failures toast", () => {
  assert.match(api, /signal: input\.signal/);
  assert.match(panel, /new AbortController\(\)/);
  assert.match(panel, /abortRef\.current\?\.abort\(\)/);
  assert.match(panel, /err instanceof DOMException && err\.name === "AbortError"/);
  assert.match(panel, /showToast\(message, true\)/);
});

test("every user-facing string in the panel resolves through i18n", () => {
  for (const locale of ["ko", "en", "zh-Hans", "zh-Hant"]) {
    const strings = JSON.parse(readFileSync(`ui/src/i18n/${locale}.json`, "utf8"));
    assert.ok(strings.vectorize, `${locale} is missing the vectorize block`);
    for (const key of ["title", "open", "hint", "run", "running", "preset_auto", "preset_mono", "saveError"]) {
      assert.ok(strings.vectorize[key], `${locale}.vectorize.${key} is missing`);
    }
  }
});
