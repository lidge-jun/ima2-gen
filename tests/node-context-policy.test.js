import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("routes/nodes.ts", "utf-8");
const oauth = readFileSync("lib/oauthProxy.ts", "utf-8");

describe("node context and edit search policy", () => {
  it("defaults node context to parent-plus-refs and rejects ancestry until implemented", () => {
    assert.match(route, /contextMode: rawContextMode = "parent-plus-refs"/);
    assert.match(route, /CONTEXT_MODE_UNSUPPORTED/);
  });

  it("defaults web_search on while honoring an explicit off switch", () => {
    assert.match(route, /searchMode: rawSearchMode = "on"/);
    assert.match(route, /body\.webSearchEnabled !== false && searchMode !== "off"/);
    assert.match(oauth, /resolveWebSearchEnabled/);
    assert.match(oauth, /\.\.\(webSearchEnabled \? \[\{ type: "web_search" \}\] : \[\]\)/);
    assert.match(oauth, /webSearchEnabled/);
  });

  it("logs safe context shape instead of raw prompts or images", () => {
    assert.match(route, /inputImageCount/);
    assert.match(route, /parentImagePresent/);
    assert.match(route, /webSearchEnabled/);
    assert.match(oauth, /inputImageCount: 1 \+ references\.length/);
    assert.doesNotMatch(oauth, /logEvent\("oauth-edit", "request", \{[^}]*prompt/);
  });
});
