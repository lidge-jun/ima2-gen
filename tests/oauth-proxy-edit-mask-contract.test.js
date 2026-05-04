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

describe("oauth proxy edit mask contract", () => {
  it("keeps the legacy OAuth helper mask rejection explicit", () => {
    const source = readSource("lib/oauthProxy.ts");
    assert.match(source, /typeof options\.mask === "string"/);
    assert.match(source, /mask_unsupported/);
    assert.match(source, /EDIT_MASK_NOT_SUPPORTED/);
    assert.doesNotMatch(source, /maskB64[\s\S]{0,200}input_text/);
  });

  it("uses the Responses adapter for route-level mask-guided edits", () => {
    const route = readSource("routes/edit.ts");
    const adapter = readSource("lib/responsesImageAdapter.ts");
    assert.match(route, /editViaResponses/);
    assert.match(route, /mask: maskCheck\.mask/);
    assert.match(adapter, /mask guide/);
  });
});
