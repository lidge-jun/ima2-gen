import { describe, it } from "node:test";
import assert from "node:assert";
import { coerceStyleSheet, renderStyleSheetPrefix } from "../lib/styleSheet.js";

describe("coerceStyleSheet", () => {
  it("returns null on non-object input", () => {
    assert.strictEqual(coerceStyleSheet(null), null);
    assert.strictEqual(coerceStyleSheet("x"), null);
    assert.strictEqual(coerceStyleSheet(42), null);
    assert.strictEqual(coerceStyleSheet([]), null);
  });

  it("returns null when no field has content", () => {
    assert.strictEqual(coerceStyleSheet({}), null);
    assert.strictEqual(coerceStyleSheet({ palette: [], negative: [], mood: "   " }), null);
  });

  it("trims strings and caps at 400 chars", () => {
    const long = "a".repeat(600);
    const s = coerceStyleSheet({
      composition: "  centered  ",
      mood: long,
      medium: "photo",
      subject_details: "\ndetails\n",
    });
    assert.strictEqual(s.composition, "centered");
    assert.strictEqual(s.mood.length, 400);
    assert.strictEqual(s.medium, "photo");
    assert.strictEqual(s.subject_details, "details");
  });

  it("caps palette at 6 items and negative at 4 items", () => {
    const s = coerceStyleSheet({
      palette: ["#1", "#2", "#3", "#4", "#5", "#6", "#7", "#8"],
      negative: ["blur", "watermark", "text", "deformed", "extra"],
    });
    assert.strictEqual(s.palette.length, 6);
    assert.strictEqual(s.negative.length, 4);
  });

  it("ignores non-string palette/negative entries", () => {
    const s = coerceStyleSheet({
      palette: ["#1", 42, null, "#2"],
      negative: ["blur", {}, "text"],
    });
    assert.deepStrictEqual(s.palette, ["#1", "#2"]);
    assert.deepStrictEqual(s.negative, ["blur", "text"]);
  });
});

describe("renderStyleSheetPrefix", () => {
  it("returns empty for null/empty sheet", () => {
    assert.strictEqual(renderStyleSheetPrefix(null), "");
    assert.strictEqual(renderStyleSheetPrefix(coerceStyleSheet({})), "");
  });

  it("produces compact labeled string", () => {
    const s = coerceStyleSheet({
      medium: "oil painting",
      palette: ["#0a0a0a", "#f97316"],
      mood: "cinematic",
      composition: "centered portrait",
    });
    const out = renderStyleSheetPrefix(s);
    assert.match(out, /Medium: oil painting/);
    assert.match(out, /Palette: #0a0a0a, #f97316/);
    assert.match(out, /Mood: cinematic/);
    assert.match(out, /Composition: centered portrait/);
  });

  it("prefixes negative list with 'Avoid:'", () => {
    const s = coerceStyleSheet({
      medium: "photo",
      negative: ["blur", "watermark"],
    });
    const out = renderStyleSheetPrefix(s);
    assert.match(out, /Avoid: blur, watermark/);
  });

  it("omits empty fields", () => {
    const s = coerceStyleSheet({ medium: "photo" });
    const out = renderStyleSheetPrefix(s);
    assert.strictEqual(out.includes("Palette:"), false);
    assert.strictEqual(out.includes("Mood:"), false);
    assert.strictEqual(out.includes("Composition:"), false);
    assert.strictEqual(out.includes("Avoid:"), false);
  });
});
