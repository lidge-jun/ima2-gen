import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// WP2 (devlog/_plan/260726_zero-backlog-frontend-qa/020_touch_target_responsive.md):
// icon-only controls keep a 44px hit box at every viewport, mid-width layouts do not
// collapse, and reduced-motion never freezes the indicators that carry state.

function ruleFor(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  assert.ok(match, `selector not found: ${selector}`);
  return match[1];
}

test("icon-only controls keep a 44px hit box by default, not only on mobile", () => {
  const gallery = readFileSync("ui/src/styles/gallery-modal.css", "utf8");
  const assets = readFileSync("ui/src/styles/assets-workspace.css", "utf8");

  for (const [css, selector] of [
    [gallery, ".gallery__close"],
    [assets, ".assets-folders__heading button"],
    [assets, ".assets-folder-row__actions button"],
    [assets, ".assets-workspace__detail-close"],
  ] as const) {
    const rule = ruleFor(css, selector);
    assert.match(rule, /height:\s*44px/, `${selector} needs a 44px height`);
    assert.match(rule, /width:\s*44px/, `${selector} needs a 44px width`);
  }
});

test("the folder row is tall enough to hold its 44px action buttons", () => {
  // The action cluster is absolutely positioned over the row. A 44px button inside a
  // ~31px row would overflow its own bounds.
  const assets = readFileSync("ui/src/styles/assets-workspace.css", "utf8");
  assert.match(ruleFor(assets, ".assets-folder-row"), /min-height:\s*44px/);
});

test("assets columns flex instead of pinning fixed track widths", () => {
  const assets = readFileSync("ui/src/styles/assets-workspace.css", "utf8");
  const base = ruleFor(assets, ".assets-workspace");
  const detail = ruleFor(assets, ".assets-workspace--detail-open");
  assert.match(base, /minmax\(160px, 220px\)/, "sidebar track must be able to shrink");
  assert.match(detail, /minmax\(280px, 360px\)/, "detail track must be able to shrink");
});

test("the size picker collapses on container width, not viewport width", () => {
  // SizePicker renders in the right panel and in the mobile sheet; a viewport media
  // query cannot see a narrow sheet inside a wide window.
  const controls = readFileSync("ui/src/styles/form-controls.css", "utf8");
  assert.match(ruleFor(controls, ".size-picker"), /container-type:\s*inline-size/);
  assert.match(controls, /@container \(max-width: 320px\)[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
});

test("reduced motion has a global fallback that spares state-carrying indicators", () => {
  const index = readFileSync("ui/src/index.css", "utf8");
  assert.match(index, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(index, /\[data-motion-essential\]/, "the escape hatch must exist");
  assert.match(index, /animation-duration:\s*0\.01ms\s*!important/);
});

test("progress indicators opt out of the reduced-motion freeze", () => {
  const inflight = readFileSync("ui/src/components/InFlightList.tsx", "utf8");
  const agent = readFileSync("ui/src/components/agent/AgentSessionSpinner.tsx", "utf8");
  assert.match(inflight, /in-flight-spinner[\s\S]{0,120}data-motion-essential/);
  assert.match(inflight, /role="progressbar"[\s\S]{0,80}data-motion-essential|data-motion-essential[\s\S]{0,80}role="progressbar"/);
  assert.match(agent, /data-motion-essential/);
  // Motion must never be the only signal: the same elements expose text/ARIA state.
  assert.match(inflight, /aria-valuenow=/);
  assert.match(agent, /aria-label=\{label\}/);
});
