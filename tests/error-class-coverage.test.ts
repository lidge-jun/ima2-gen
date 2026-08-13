import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { GENERATION_ERROR_CLASSES } from "../lib/errors/classes.ts";
import {
  DYNAMIC_PROVIDER_CODE_SITES,
  PROVIDER_ERROR_MAP,
} from "../lib/errors/providerMap.ts";

const ADAPTER_FILES = [
  "lib/minimaxImageAdapter.ts",
  "lib/geminiApiImageAdapter.ts",
  "lib/agyImageAdapter.ts",
  "lib/atlasCloudImageAdapter.ts",
  ...readdirSync("lib")
    .filter((file) => /^grok.*\.ts$/i.test(file))
    .map((file) => `lib/${file}`),
] as const;

const PROVIDER_CODE_PATTERN = /\b(?:MINIMAX|GEMINI_API|GROK|AGY|ATLASCLOUD)_[A-Z0-9_]+\b/g;
const LEXICAL_EXCEPTIONS = new Set([
  "AGY_MAX_OUTPUT_BYTES",
  "AGY_OUTPUT_RESOLUTION",
  "AGY_TIMEOUT_MS",
  "ATLASCLOUD_EDIT_MODEL",
  "ATLASCLOUD_TEXT_TO_IMAGE_MODEL",
  "GEMINI_API_KEY",
  "GROK_FALLBACK_VIDEO_MODEL",
  "GROK_PLANNER",
  "GROK_SEARCH",
  "GROK_VIDEO_MODEL_15",
  "GROK_VIDEO_MODEL_15_PREVIEW_ALIAS",
  "GROK_VIDEO_MODEL_BASE",
  "MINIMAX_IMAGE_TO_IMAGE_MODEL",
  "MINIMAX_TEXT_TO_IMAGE_MODEL",
  "MINIMAX_TIMEOUT_MS",
]);
const DYNAMIC_CONSTRUCTION_PATTERN = /\$\{([A-Za-z_$][\w$]*)\}_([A-Z][A-Z0-9_]*)/g;

function source(path: string): string {
  return readFileSync(path, "utf8");
}

function lexicalProviderCodes(): Set<string> {
  const codes = new Set<string>();
  for (const file of ADAPTER_FILES) {
    for (const code of source(file).match(PROVIDER_CODE_PATTERN) ?? []) codes.add(code);
  }
  return codes;
}

function dynamicSitesFromSource(): string[] {
  const sites: string[] = [];
  for (const file of ADAPTER_FILES) {
    for (const match of source(file).matchAll(DYNAMIC_CONSTRUCTION_PATTERN)) {
      sites.push(`${file}:${match[1]}:${match[2]}`);
    }
  }
  return sites.sort();
}

function declaredPrefixDomain(file: string, variable: string): string[] {
  const declaration = source(file).match(new RegExp(`const\\s+${variable}\\s*=([^;]+);`));
  assert.ok(declaration, `missing dynamic prefix declaration ${file}:${variable}`);
  return [...new Set(declaration[1].match(PROVIDER_CODE_PATTERN) ?? [])].sort();
}

test("every provider map key has one of the common error classes", () => {
  const classes = new Set<string>(GENERATION_ERROR_CLASSES);
  assert.equal(Object.keys(PROVIDER_ERROR_MAP).length, 64);
  for (const [code, errorClass] of Object.entries(PROVIDER_ERROR_MAP)) {
    assert.ok(classes.has(errorClass), `${code} has invalid class ${errorClass}`);
  }
});

test("lexically emitted provider codes are mapped or explicitly excepted", () => {
  const unmapped = [...lexicalProviderCodes()]
    .filter((code) => !(code in PROVIDER_ERROR_MAP) && !LEXICAL_EXCEPTIONS.has(code))
    .sort();
  assert.deepEqual(unmapped, []);
});

test("dynamic provider-code sites and expanded outputs stay pinned", () => {
  const expectedSites = DYNAMIC_PROVIDER_CODE_SITES
    .map((site) => `${site.file}:${site.prefixVariable}:${site.suffix}`)
    .sort();
  assert.deepEqual(dynamicSitesFromSource(), expectedSites);

  for (const site of DYNAMIC_PROVIDER_CODE_SITES) {
    assert.deepEqual(declaredPrefixDomain(site.file, site.prefixVariable), [...site.prefixDomain].sort());
    const expanded = site.prefixDomain.map((prefix) => `${prefix}_${site.suffix}`).sort();
    assert.deepEqual(expanded, [...site.expandedCodes].sort());
    for (const code of expanded) assert.ok(code in PROVIDER_ERROR_MAP, `dynamic code is unmapped: ${code}`);
  }
});
