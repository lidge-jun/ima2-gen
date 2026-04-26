import { describe, it } from "node:test";
import assert from "node:assert";
import { hintForErrorCode, formatErrorWithHint } from "../bin/lib/error-hints.js";

describe("CLI error hints", () => {
  it("maps network/oauth errors separately from moderation", () => {
    assert.match(hintForErrorCode("NETWORK_FAILED"), /not a moderation/i);
    assert.match(hintForErrorCode("OAUTH_UNAVAILABLE"), /OAuth/i);
    assert.match(hintForErrorCode("MODERATION_REFUSED"), /moderation/i);
  });

  it("formats known code with hint", () => {
    const msg = formatErrorWithHint("failed", "REF_TOO_LARGE");
    assert.match(msg, /failed/);
    assert.match(msg, /Resize|compress/i);
  });

  it("keeps unknown code simple", () => {
    assert.strictEqual(formatErrorWithHint("failed", "UNKNOWN_X"), "failed");
  });
});
