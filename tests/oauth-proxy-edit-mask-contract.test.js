import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("oauth proxy edit mask contract", () => {
  it("rejects masked edits explicitly until a verified provider path exists", () => {
    const source = readSource("lib/oauthProxy.ts");
    assert.match(source, /typeof options\.mask === "string"/);
    assert.match(source, /mask_unsupported/);
    assert.match(source, /EDIT_MASK_NOT_SUPPORTED/);
    assert.doesNotMatch(source, /maskB64[\s\S]{0,200}input_text/);
  });
});
