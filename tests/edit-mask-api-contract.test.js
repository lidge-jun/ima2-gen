import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("edit mask API contract", () => {
  it("validates optional PNG alpha masks before provider calls", () => {
    const route = readSource("routes/edit.js");
    assert.match(route, /mask: rawMask/);
    assert.match(route, /validateEditMask/);
    assert.match(route, /INVALID_EDIT_MASK_BASE64/);
    assert.match(route, /INVALID_EDIT_MASK_PNG/);
    assert.match(route, /EDIT_MASK_TOO_LARGE/);
    assert.match(route, /EDIT_MASK_NO_ALPHA/);
    assert.match(route, /EDIT_MASK_DIMENSION_MISMATCH/);
    assert.match(route, /maskPresent/);
    assert.match(route, /maskBytes/);
    assert.doesNotMatch(route, /rawMask[\s\S]{0,120}logEvent/);
  });

  it("keeps unsupported mask provider behavior explicit", () => {
    const oauth = readSource("lib/oauthProxy.js");
    assert.match(oauth, /options\.mask/);
    assert.match(oauth, /EDIT_MASK_NOT_SUPPORTED/);
    assert.match(oauth, /mask_unsupported/);
  });

  it("parses PNG IHDR metadata through a helper", () => {
    const png = readSource("lib/pngInfo.js");
    assert.match(png, /export function parsePngInfo/);
    assert.match(png, /readUInt32BE\(16\)/);
    assert.match(png, /readUInt32BE\(20\)/);
    assert.match(png, /colorType/);
    assert.match(png, /hasPngAlphaChannel/);
  });
});
