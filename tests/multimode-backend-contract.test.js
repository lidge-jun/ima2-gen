import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("multimode backend contract", () => {
  it("registers a separate multimode route instead of overloading classic generate", () => {
    const index = readSource("routes/index.ts");
    const route = readSource("routes/multimode.ts");
    const classic = readSource("routes/generate.ts");

    assert.match(index, /registerMultimodeRoutes/);
    assert.match(route, /app\.post\("\/api\/generate\/multimode"/);
    assert.match(route, /normalizeMaxImages/);
    assert.match(route, /generateMultimodeViaOAuth/);
    assert.match(classic, /Promise\.allSettled\(Array\.from\(\{ length: count \}, generateOne\)\)/);
  });

  it("uses a strict prompt wrapper and collects multiple image_generation_call outputs", () => {
    const oauth = readSource("lib/oauthProxy.ts");

    assert.match(oauth, /export function buildMultimodeSequencePrompt/);
    assert.match(oauth, /You MUST create up to N separate image_generation_call outputs/);
    assert.match(oauth, /Do not create a collage/);
    assert.match(oauth, /Do not create a grid/);
    assert.match(oauth, /Do not create a contact sheet/);
    assert.match(oauth, /Do not create a storyboard sheet/);
    assert.match(oauth, /Do not put multiple panels inside one image/);
    assert.match(oauth, /async function readMultimodeImageStream/);
    assert.match(oauth, /const images = \[\]/);
    assert.match(oauth, /images\.push\(/);
    assert.match(oauth, /extraIgnored/);
    assert.match(oauth, /buildImageTools\(webSearchEnabled/);
    assert.match(oauth, /\.\.\(webSearchEnabled \? \[\{ type: "web_search" \}\] : \[\]\)/);
    assert.match(oauth, /tool_choice: "required"/);
  });

  it("persists sequence metadata and surfaces it through history", () => {
    const route = readSource("routes/multimode.ts");
    const history = readSource("lib/historyList.ts");
    const api = readSource("ui/src/lib/api.ts");

    for (const source of [route, history, api]) {
      assert.match(source, /sequenceId/);
      assert.match(source, /sequenceIndex/);
      assert.match(source, /sequenceTotalRequested/);
      assert.match(source, /sequenceTotalReturned/);
      assert.match(source, /sequenceStatus/);
    }
    assert.match(route, /kind: "multimode-image"/);
    assert.match(route, /generationStrategy: "one-call-text-sequence"/);
  });
});
