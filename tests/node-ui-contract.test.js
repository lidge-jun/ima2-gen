import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("node UI compact metadata contract", () => {
  it("keeps node metadata in a fixed clipped footer slot", () => {
    const component = readSource("ui/src/components/ImageNode.tsx");
    const css = readSource("ui/src/index.css");
    const statusRule = /\.image-node__status\s*\{[^}]*\}/s.exec(css)?.[0] ?? "";
    const actionsRule = /\.image-node__actions\s*\{[^}]*\}/s.exec(css)?.[0] ?? "";

    assert.match(component, /className="image-node__status" title=\{statusLabel\}/);
    assert.match(statusRule, /overflow:\s*hidden/);
    assert.match(statusRule, /text-overflow:\s*ellipsis/);
    assert.match(statusRule, /white-space:\s*nowrap/);
    assert.match(actionsRule, /display:\s*grid/);
    assert.match(actionsRule, /grid-template-columns:/);
  });

  it("uses compact regenerate labels", () => {
    const en = readSource("ui/src/i18n/en.json");
    const ko = readSource("ui/src/i18n/ko.json");

    assert.match(en, /"regenerate":\s*"Regen"/);
    assert.match(en, /"addChild":\s*"Child"/);
    assert.match(en, /"duplicateBranch":\s*"Branch"/);
    assert.match(ko, /"regenerate":\s*"재생성"/);
    assert.match(ko, /"addChild":\s*"자식"/);
    assert.match(ko, /"duplicateBranch":\s*"복제"/);
    assert.doesNotMatch(en, /"regenerate":\s*"Regenerate"/);
  });

  it("makes node connection handles easier to target", () => {
    const canvas = readSource("ui/src/components/NodeCanvas.tsx");
    const css = readSource("ui/src/index.css");
    const handleRule = /\.image-node__handle\s*\{[^}]*\}/s.exec(css)?.[0] ?? "";
    const hitRule = /\.image-node__handle::before\s*\{[^}]*\}/s.exec(css)?.[0] ?? "";
    const hoverRule = /\.image-node:hover \.image-node__handle,[^{]+\{[^}]*\}/s.exec(css)?.[0] ?? "";

    assert.match(canvas, /connectionRadius=\{32\}/);
    assert.match(handleRule, /transition:/);
    assert.match(hitRule, /inset:\s*-9px/);
    assert.match(hoverRule, /width:\s*14px !important/);
    assert.match(hoverRule, /height:\s*14px !important/);
    assert.match(hoverRule, /box-shadow:/);
  });
});
