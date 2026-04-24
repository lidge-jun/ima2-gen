import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Mirror of ui/src/lib/styleChips.ts — keep in sync.
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isChipActive(prompt, token) {
  if (!prompt) return false;
  const re = new RegExp(`(^|,\\s*)${escapeRegExp(token)}(?=\\s*(?:,|$))`);
  return re.test(prompt);
}

function toggleChip(prompt, token) {
  const trimmed = prompt.trim();
  if (isChipActive(trimmed, token)) {
    const re = new RegExp(`(^|,\\s*)${escapeRegExp(token)}(?=\\s*(?:,|$))`);
    const next = trimmed.replace(re, () => "");
    return next.replace(/^,\s*/, "").replace(/,\s*,/g, ",").trim();
  }
  if (!trimmed) return token;
  return `${trimmed}, ${token}`;
}

describe("styleChips.toggleChip", () => {
  it("adds a token to empty prompt", () => {
    assert.equal(toggleChip("", "시네마틱"), "시네마틱");
  });
  it("appends with comma separator", () => {
    assert.equal(toggleChip("셀카", "자연광"), "셀카, 자연광");
  });
  it("removes an existing token at end", () => {
    assert.equal(toggleChip("셀카, 자연광", "자연광"), "셀카");
  });
  it("removes an existing token in middle", () => {
    assert.equal(toggleChip("셀카, 자연광, 전신", "자연광"), "셀카, 전신");
  });
  it("removes a standalone token", () => {
    assert.equal(toggleChip("자연광", "자연광"), "");
  });
  it("isChipActive detects mid-string token", () => {
    assert.equal(isChipActive("셀카, 자연광, 전신", "자연광"), true);
  });
  it("isChipActive rejects partial match", () => {
    assert.equal(isChipActive("자연광선", "자연광"), false);
  });
});
