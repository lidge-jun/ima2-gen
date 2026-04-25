import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("routes/nodes.js", "utf-8");
const oauth = readFileSync("lib/oauthProxy.js", "utf-8");

describe("node context and edit search policy", () => {
  it("defaults node context to parent-plus-refs and rejects ancestry until implemented", () => {
    assert.match(route, /contextMode: rawContextMode = "parent-plus-refs"/);
    assert.match(route, /CONTEXT_MODE_UNSUPPORTED/);
  });

  it("keeps edit search off by default but exposes explicit on mode", () => {
    assert.match(route, /searchMode: rawSearchMode = "off"/);
    assert.match(oauth, /const searchMode = options\.searchMode === "on" \? "on" : "off"/);
    assert.match(oauth, /\.\.\(searchMode === "on" \? \[\{ type: "web_search" \}\] : \[\]\)/);
  });

  it("logs safe context shape instead of raw prompts or images", () => {
    assert.match(route, /inputImageCount/);
    assert.match(route, /parentImagePresent/);
    assert.match(route, /webSearchEnabled/);
    assert.match(oauth, /inputImageCount: 1 \+ references\.length/);
    assert.doesNotMatch(oauth, /logEvent\("oauth-edit", "request", \{[^}]*prompt/);
  });
});

