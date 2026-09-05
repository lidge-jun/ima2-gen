// The left rail used to be icon-only, relying on the native `title` tooltip: a ~500ms
// browser delay that keyboard users never see at all. These assertions fail on the
// pre-fix tree and pass after it (devlog/_plan/260812_navrail_grok_autotag/010).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const NAV_RAIL_TSX = new URL("../ui/src/components/NavRail.tsx", import.meta.url);
const NAV_RAIL_CSS = new URL("../ui/src/styles/nav-rail.css", import.meta.url);

function mobileButtonRule(css: string): string {
  return css.match(/\.nav-rail--mobile \.nav-rail__btn\s*\{[^}]*\}/)?.[0] ?? "";
}

test("rail buttons render a styled label instead of the native title tooltip", () => {
  const src = readFileSync(NAV_RAIL_TSX, "utf8");
  assert.match(src, /className="nav-rail__label" aria-hidden="true"/);
  assert.doesNotMatch(src, /title=\{t\(item\.labelKey\)\}/);
  // The accessible name still comes from aria-label, not from the visual label.
  assert.match(src, /aria-label=\{t\(item\.labelKey\)\}/);
});

test("the label reveals on hover and on keyboard focus", () => {
  const css = readFileSync(NAV_RAIL_CSS, "utf8");
  assert.match(css, /\.nav-rail__btn:hover \.nav-rail__label/);
  assert.match(css, /\.nav-rail__btn:focus-visible \.nav-rail__label/);
});

test("the flyout escapes the rail without widening the grid column", () => {
  const css = readFileSync(NAV_RAIL_CSS, "utf8");
  const railRule = css.match(/\.nav-rail\s*\{[^}]*\}/)?.[0] ?? "";
  // --nav-rail-w is a grid column in six workspaces; widening the rail reflows all of them.
  assert.match(railRule, /width:\s*52px/);
  assert.match(railRule, /overflow:\s*visible/);
  const labelRule = css.match(/\.nav-rail__label\s*\{[^}]*\}/)?.[0] ?? "";
  assert.match(labelRule, /position:\s*absolute/);
  assert.match(labelRule, /pointer-events:\s*none/);
});

test("the touch tab bar keeps its labels permanently visible", () => {
  const css = readFileSync(NAV_RAIL_CSS, "utf8");
  assert.match(css, /\.nav-rail--mobile \.nav-rail__label\s*\{[^}]*opacity:\s*1/);
});

test("the touch tab bar keeps a 44px touch target in both axes", () => {
  const rule = mobileButtonRule(readFileSync(NAV_RAIL_CSS, "utf8"));
  assert.match(rule, /min-width:\s*44px/);
  assert.match(rule, /min-height:\s*44px/);
});

test("mobile navigation scrolls its own horizontal rail", () => {
  const src = readFileSync(NAV_RAIL_TSX, "utf8");
  const css = readFileSync(NAV_RAIL_CSS, "utf8");
  assert.match(src, /mobileNavRef/);
  assert.match(src, /nav\.scrollLeft/);
  assert.doesNotMatch(src, /scrollIntoView/);
  assert.match(css, /overflow-x:\s*auto/);
  assert.match(css, /flex:\s*0 0 auto/);
});
