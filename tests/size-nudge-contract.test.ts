import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

import { aspectLabel, orientationOf, parseSizeSpec, sizeDrifted, sizeNudgeSuffix } from "../lib/sizeNudge.ts";

const read = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

describe("size nudge (#173)", () => {
  it("names the orientation, because a rotated result keeps the ratio", () => {
    // 1024x1536 coming back as 1536x1024 is the reported failure: the ratio is
    // right and the composition is ruined.
    const portrait = sizeNudgeSuffix("1024x1536") ?? "";
    assert.match(portrait, /tall vertical portrait/);
    assert.match(portrait, /2:3 aspect ratio/);
    assert.match(portrait, /Do not produce a square or landscape image/);

    const landscape = sizeNudgeSuffix("1536x1024") ?? "";
    assert.match(landscape, /wide horizontal landscape/);
    assert.match(landscape, /Do not produce a square or portrait image/);

    assert.match(sizeNudgeSuffix("1024x1024") ?? "", /MUST be square/);
  });

  it("reduces a non-standard size to a readable ratio", () => {
    assert.equal(aspectLabel({ width: 864, height: 1536 }), "9:16");
    assert.equal(orientationOf({ width: 864, height: 1536 }), "portrait");
    assert.match(sizeNudgeSuffix("864x1536") ?? "", /9:16 aspect ratio \(width 864, height 1536\)/);
  });

  it("keeps quiet when there is no concrete size to restate", () => {
    assert.equal(sizeNudgeSuffix("auto"), null);
    assert.equal(sizeNudgeSuffix(undefined), null);
    assert.equal(parseSizeSpec("not-a-size"), null);
  });

  it("refuses to call an unreadable ratio a ratio", () => {
    // 941:1672 as a "ratio" helps nobody, so it reports the pair verbatim.
    assert.equal(aspectLabel({ width: 941, height: 1672 }), "941:1672");
  });

  it("detects drift only when both sizes are known", () => {
    assert.equal(sizeDrifted("864x1536", parseSizeSpec("941x1672")), true);
    assert.equal(sizeDrifted("1024x1536", parseSizeSpec("1024x1536")), false);
    assert.equal(sizeDrifted("auto", parseSizeSpec("1024x1024")), false);
    assert.equal(sizeDrifted("1024x1024", null), false);
  });
});

describe("size visibility wiring (#173)", () => {
  it("appends the nudge to the generation prompt with an opt-out", () => {
    const pipeline = read("lib/generatePipeline.ts");
    assert.match(pipeline, /req\.body\?\.sizeNudge === false \? null : sizeNudgeSuffix\(req\.body\?\.size\)/);
    assert.match(pipeline, /\(sizeNudge \? ` \$\{sizeNudge\}` : ""\)/);
  });

  it("prints the delivered pixels and flags a mismatch", () => {
    const gen = read("bin/commands/gen.ts");
    assert.match(gen, /async function measureSaved/);
    assert.match(gen, /requested \$\{String\(requested\)\}; the provider returned a different size/);
  });

  it("splits requestedSize from actualSize in json output", () => {
    const gen = read("bin/commands/gen.ts");
    assert.match(gen, /requestedSize: args\.size \? String\(args\.size\) : null/);
    assert.match(gen, /actualSize: measured\[index\]/);
  });

  it("offers the documented escape hatch", () => {
    const gen = read("bin/commands/gen.ts");
    assert.match(gen, /"no-size-nudge": \{ type: "boolean" \}/);
    assert.match(gen, /--no-size-nudge/);
    assert.match(gen, /args\["no-size-nudge"\] \? \{ sizeNudge: false \}/);
  });
});
