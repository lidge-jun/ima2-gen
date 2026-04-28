import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path) {
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
    const generate = readSource("routes/generate.js");
    const nodes = readSource("routes/nodes.js");
    const oauth = readSource("lib/oauthProxy.js");

    assert.match(generate, /webSearchEnabled: rawWebSearchEnabled = true/);
    assert.match(nodes, /searchMode: rawSearchMode = "on"/);
    assert.match(nodes, /body\.webSearchEnabled !== false && searchMode !== "off"/);
    assert.match(oauth, /function resolveWebSearchEnabled/);
    assert.match(oauth, /\.\.\(webSearchEnabled \? \[\{ type: "web_search" \}\] : \[\]\)/);
  });
});
