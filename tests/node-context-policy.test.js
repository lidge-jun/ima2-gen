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

  it("forces web_search on for every edit so factual prompts always research first", () => {
    assert.match(route, /searchMode: rawSearchMode = "on"/);
    assert.match(oauth, /\{ type: "web_search" \},\s*\{ type: "image_generation"/);
    assert.match(oauth, /webSearchEnabled: true/);
  });

  it("logs safe context shape instead of raw prompts or images", () => {
    assert.match(route, /inputImageCount/);
    assert.match(route, /parentImagePresent/);
    assert.match(route, /webSearchEnabled/);
    assert.match(oauth, /inputImageCount: 1 \+ references\.length/);
    assert.doesNotMatch(oauth, /logEvent\("oauth-edit", "request", \{[^}]*prompt/);
  });
});

