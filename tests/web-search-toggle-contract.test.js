import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

// NOTE: lib/oauthProxy.ts was split into lib/oauthProxy/*.ts behind a facade;
// readSource("lib/oauthProxy.ts") now returns all split sources concatenated.
const OAUTH_PROXY_SOURCES = [
  "lib/oauthProxy.ts",
  "lib/oauthProxy/types.ts",
  "lib/oauthProxy/prompts.ts",
  "lib/oauthProxy/references.ts",
  "lib/oauthProxy/errors.ts",
  "lib/oauthProxy/runtime.ts",
  "lib/oauthProxy/streams.ts",
  "lib/oauthProxy/generators.ts",
  "lib/oauthProxy/index.ts",
];

function readSource(path) {
  if (path === "lib/oauthProxy.ts") {
    return OAUTH_PROXY_SOURCES.map((p) => readFileSync(join(root, p), "utf8")).join("\n");
  }
  return readFileSync(join(root, path), "utf8");
}

describe("web search toggle contract", () => {
  it("surfaces the toggle in both settings and the prompt composer", () => {
    const settings = readSource("ui/src/components/SettingsWorkspace.tsx");
    const composer = readSource("ui/src/components/PromptComposer.tsx");

    assert.match(settings, /<WebSearchToggle \/>/);
    assert.match(composer, /<WebSearchToggle variant="compact" \/>/);
  });

  it("persists the toggle and sends it with all generation requests", () => {
    const store = readSource("ui/src/store/useAppStore.ts");
    const types = readSource("ui/src/types.ts");
    const nodeApi = readSource("ui/src/lib/nodeApi.ts");

    assert.match(types, /webSearchEnabled\?: boolean/);
    assert.match(nodeApi, /webSearchEnabled\?: boolean/);
    assert.match(store, /WEB_SEARCH_STORAGE_KEY/);
    assert.match(store, /webSearchEnabled: loadWebSearchEnabled\(\)/);
    assert.match(store, /webSearchEnabled: s\.webSearchEnabled/);
  });

  it("keeps server search on by default and removes web_search when off", () => {
    const generate = readSource("routes/generate.ts");
    const nodes = readSource("routes/nodes.ts");
    const providerOptions = readSource("lib/providerOptions.ts");
    const oauth = readSource("lib/oauthProxy.ts");
    const adapter = readSource("lib/responsesImageAdapter.ts");

    assert.match(generate, /webSearchEnabled: rawWebSearchEnabled = true/);
    assert.match(nodes, /searchMode: rawSearchMode = "on"/);
    assert.match(nodes, /resolveProviderOptions/);
    assert.match(providerOptions, /rawWebSearchEnabled !== false && searchMode !== "off"/);
    assert.match(providerOptions, /apiConfig\.allowWebSearch !== false/);
    assert.match(oauth, /function resolveWebSearchEnabled/);
    assert.match(oauth, /\.\.\(webSearchEnabled \? \[\{ type: "web_search" \}\] : \[\]\)/);
    assert.match(adapter, /\.\.\(webSearchEnabled \? \[\{ type: "web_search" \}\] : \[\]\)/);
  });
});
