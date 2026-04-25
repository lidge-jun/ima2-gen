import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const store = readFileSync("ui/src/store/useAppStore.ts", "utf-8");
const imageNode = readFileSync("ui/src/components/ImageNode.tsx", "utf-8");
const nodes = readFileSync("routes/nodes.js", "utf-8");
const oauth = readFileSync("lib/oauthProxy.js", "utf-8");

describe("child node references contract", () => {
  it("does not block child node references in the frontend", () => {
    assert.doesNotMatch(store, /parentServerNodeId\) \{\s*get\(\)\.showToast\(t\("node\.nodeRefsUnsupportedForEdit"/);
    assert.match(imageNode, /const canAttachRefs = !isBusy && refs\.length < MAX_NODE_REFS/);
    assert.match(imageNode, /node\.nodeRefsUsedWithParent/);
  });

  it("does not reject parentNodeId plus references in the node route", () => {
    assert.doesNotMatch(nodes, /NODE_REFS_UNSUPPORTED_FOR_EDIT/);
    assert.match(nodes, /references: refsForRequest/);
  });

  it("forwards edit references after the parent image and before text", () => {
    assert.match(oauth, /const references = Array\.isArray\(options\.references\)/);
    assert.match(oauth, /\{ type: "input_image", image_url: `data:image\/png;base64,\$\{imageB64\}` \}/);
    assert.match(oauth, /\.\.\.referenceContent/);
    assert.match(oauth, /\{ type: "input_text", text: textPrompt \}/);
  });

  it("logs only reference counts for edit reference requests", () => {
    assert.match(oauth, /refsCount: references\.length/);
    assert.doesNotMatch(oauth, /logEvent\("oauth-edit", "request", \{[^}]*references:/);
  });
});
