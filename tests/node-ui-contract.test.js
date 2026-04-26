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
    assert.match(actionsRule, /display:\s*flex/);
    assert.match(actionsRule, /flex:\s*0 0 auto/);
    assert.match(actionsRule, /align-items:\s*center/);
  });

  it("keeps preview height fixed while node width follows generated aspect ratio", () => {
    const component = readSource("ui/src/components/ImageNode.tsx");
    const css = readSource("ui/src/index.css");
    const nodeRule = /\.image-node\s*\{[^}]*\}/s.exec(css)?.[0] ?? "";
    const previewRule = /\.image-node__preview\s*\{[^}]*\}/s.exec(css)?.[0] ?? "";
    const imageRule = /\.image-node__preview img\s*\{[^}]*\}/s.exec(css)?.[0] ?? "";

    assert.match(component, /function getPreviewWidth\(size\?: string \| null\): number/);
    assert.match(component, /NODE_PREVIEW_HEIGHT \* \(width \/ height\)/);
    assert.match(component, /"--node-preview-w": `\$\{getPreviewWidth\(d\.size\)\}px`/);
    assert.match(nodeRule, /width:\s*var\(--node-preview-w,\s*240px\)/);
    assert.match(previewRule, /height:\s*var\(--node-preview-h,\s*240px\)/);
    assert.doesNotMatch(previewRule, /aspect-ratio:\s*1 \/ 1/);
    assert.match(imageRule, /object-fit:\s*contain/);
  });

  it("persists node output size so aspect-ratio layout survives reload", () => {
    const store = readSource("ui/src/store/useAppStore.ts");
    const api = readSource("ui/src/lib/nodeApi.ts");
    const route = readSource("routes/nodes.js");

    assert.match(api, /size\?: string \| null/);
    assert.match(route, /size,\s*\n\s*moderation/);
    assert.match(store, /size: \(d\.size \?\? null\) as string \| null/);
    assert.match(store, /size: res\.size \?\? size/);
    assert.match(store, /size: recovered\.size \?\? n\.data\.size \?\? null/);
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

  it("keeps the empty-node generate button readable in the compact footer", () => {
    const component = readSource("ui/src/components/ImageNode.tsx");
    const css = readSource("ui/src/index.css");
    const en = readSource("ui/src/i18n/en.json");
    const actionsRule = /\.image-node__actions button:first-child:not\(\.image-node__generate\),\s*\.image-node__del\s*\{[^}]*\}/s.exec(css)?.[0] ?? "";
    const generateRule = /\.image-node__generate\s*\{[^}]*\}/s.exec(css)?.[0] ?? "";

    assert.match(component, /className="image-node__generate"/);
    assert.match(component, /aria-label=\{t\("node\.generateTitle"\)\}/);
    assert.match(actionsRule, /width:\s*30px/);
    assert.match(generateRule, /min-width:\s*44px !important/);
    assert.match(en, /"generate":\s*"Gen"/);
    assert.match(en, /"generateTitle":\s*"Generate node image"/);
  });

  it("keeps light-mode canvas overlays readable on dark scrims", () => {
    const css = readSource("ui/src/index.css");
    const rootRule = /:root,\s*:root\[data-theme="dark"\]\s*\{[^}]*\}/s.exec(css)?.[0] ?? "";
    const lightRule = /:root\[data-theme="light"\]\s*\{[^}]*\}/s.exec(css)?.[0] ?? "";
    const hintRule = /\.node-canvas__hint\s*\{[^}]*\}/s.exec(css)?.[0] ?? "";
    const loadingRule = /\.node-canvas__loading\s*\{[^}]*\}/s.exec(css)?.[0] ?? "";

    assert.match(rootRule, /--on-scrim:\s*#f6f7fb/);
    assert.match(lightRule, /--on-scrim:\s*#f8fafc/);
    assert.match(hintRule, /color:\s*var\(--on-scrim\)/);
    assert.match(hintRule, /background:\s*var\(--chip-scrim\)/);
    assert.match(loadingRule, /color:\s*var\(--on-scrim\)/);
  });

  it("makes node connection handles easier to target", () => {
    const canvas = readSource("ui/src/components/NodeCanvas.tsx");
    const component = readSource("ui/src/components/ImageNode.tsx");
    const css = readSource("ui/src/index.css");
    const handleRule = /\.image-node__handle\s*\{[^}]*\}/s.exec(css)?.[0] ?? "";
    const hitRule = /\.image-node__handle::before\s*\{[^}]*\}/s.exec(css)?.[0] ?? "";
    const hoverRule = /\.image-node:hover \.image-node__handle,[^{]+\{[^}]*\}/s.exec(css)?.[0] ?? "";

    assert.match(component, /type="source"/);
    assert.match(component, /type="target"/);
    assert.match(component, /id=\{`source-\$\{handleId\}`\}/);
    assert.match(component, /id=\{`target-\$\{handleId\}`\}/);
    assert.match(canvas, /connectionRadius=\{32\}/);
    assert.match(handleRule, /transition:/);
    assert.match(hitRule, /inset:\s*-9px/);
    assert.match(hoverRule, /width:\s*14px !important/);
    assert.match(hoverRule, /height:\s*14px !important/);
    assert.match(hoverRule, /box-shadow:/);
  });

  it("preserves directional node connection handles through connect and session save", () => {
    const canvas = readSource("ui/src/components/NodeCanvas.tsx");
    const store = readSource("ui/src/store/useAppStore.ts");

    assert.match(canvas, /connectNodes\(params\.source,\s*params\.target,\s*params\.sourceHandle,\s*params\.targetHandle\)/);
    assert.match(canvas, /connectionState\.toNode \|\| connectionState\.toHandle/);
    assert.match(store, /sourceHandle\?: string \| null/);
    assert.match(store, /targetHandle\?: string \| null/);
    assert.match(store, /sourceHandle,\s*\n\s*targetHandle,/);
    assert.match(store, /sourceHandle:\s*e\.sourceHandle \?\? null/);
    assert.match(store, /targetHandle:\s*e\.targetHandle \?\? null/);
    assert.match(store, /sourceHandle:\s*typeof data\.sourceHandle === "string" \? data\.sourceHandle : null/);
    assert.match(store, /targetHandle:\s*typeof data\.targetHandle === "string" \? data\.targetHandle : null/);
  });
});
