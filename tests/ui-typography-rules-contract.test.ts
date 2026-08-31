import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { createRequire } from "node:module";

// wp3 (devlog/_plan/260831_ui_polish_round/020_wp3_typography.md): letter-spacing
// stays at 0 or above, font-size never scales with viewport width, and the four
// stepped ladders hold the exact values the plan fixed.
//
// Asserting only "no viewport units" would pass an implementation that shrank
// every heading to 8px, so the values themselves are the oracle. The pre-removal
// clamp expressions are frozen below as an independent baseline: they are what the
// ladder is allowed to deviate from, and they cannot be re-derived from CSS once
// the migration lands.
const require = createRequire(import.meta.url);
type PostcssNode = { type: string; name?: string; params?: string; selector?: string; parent?: PostcssNode };
type PostcssDecl = PostcssNode & { prop: string; value: string; source?: { start?: { line: number } } };
const postcss = require("../ui/node_modules/postcss") as {
  parse(css: string, opts?: { from?: string }): {
    walkDecls(cb: (decl: PostcssDecl) => void): void;
  };
};

const WIDTHS = [320, 480, 481, 767, 768, 769, 1024, 1025, 1279, 1280, 1920];

type Ladder = {
  selector: string;
  steps: { maxWidth: number | null; px: number }[];
  baseline: (w: number) => number;
  maxDeviation: number;
  maxJump: number;
};

const clamp = (min: number, pref: number, max: number) => Math.min(Math.max(pref, min), max);

// Frozen pre-wp3 clamp expressions, transcribed from the CSS this unit replaced.
const LADDERS: Ladder[] = [
  {
    selector: ".home-hero__mark",
    steps: [{ maxWidth: 480, px: 100 }, { maxWidth: 1024, px: 125 }, { maxWidth: 1279, px: 150 }, { maxWidth: null, px: 176 }],
    baseline: (w) =>
      w <= 480 ? clamp(64, 0.26 * w, 104) : w <= 768 ? clamp(84, 0.22 * w, 150) : clamp(84, 0.13 * w, 176),
    maxDeviation: 25.5,
    maxJump: 26,
  },
  {
    selector: ".home-hero__title",
    steps: [{ maxWidth: 480, px: 28 }, { maxWidth: 1279, px: 30 }, { maxWidth: null, px: 34 }],
    baseline: (w) => (w <= 480 ? clamp(26, 0.08 * w, 32) : clamp(24, 0.028 * w, 34)),
    maxDeviation: 6.5,
    maxJump: 4,
  },
  {
    selector: ".home-workspace h2",
    steps: [{ maxWidth: 1279, px: 22 }, { maxWidth: null, px: 26 }],
    baseline: (w) => clamp(20, 0.025 * w, 26),
    maxDeviation: 4.5,
    maxJump: 4,
  },
  {
    selector: ".assets-tile__glyph",
    steps: [{ maxWidth: 480, px: 40 }, { maxWidth: 768, px: 52 }, { maxWidth: 1279, px: 64 }, { maxWidth: null, px: 72 }],
    baseline: (w) => clamp(36, 0.07 * w, 72),
    maxDeviation: 16.5,
    maxJump: 12,
  },
];

function cssFiles(dir = "ui/src"): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...cssFiles(path));
    else if (entry.name.endsWith(".css")) out.push(path);
  }
  return out.sort();
}

const normalize = (path: string) => path.split(sep).join("/");

type SizeDecl = { file: string; line: number; selector: string; maxWidth: number | null; value: string; order: number };

function fontDecls(): SizeDecl[] {
  const found: SizeDecl[] = [];
  let order = 0;
  for (const file of cssFiles()) {
    const root = postcss.parse(readFileSync(file, "utf8"), { from: file });
    root.walkDecls((decl) => {
      if (!/^(font|font-size)$/.test(decl.prop)) return;
      let maxWidth: number | null = null;
      let widthQuery = true;
      let parent = decl.parent;
      while (parent) {
        if (parent.type === "atrule") {
          const params = String(parent.params);
          const match = params.match(/max-width:\s*(\d+)px/);
          if (match) maxWidth = maxWidth === null ? Number(match[1]) : Math.min(maxWidth, Number(match[1]));
          else if (/hover|pointer|prefers|min-width/.test(params)) widthQuery = false;
        }
        parent = parent.parent;
      }
      if (!widthQuery) return;
      found.push({
        file: normalize(file),
        line: decl.source?.start?.line ?? 0,
        selector: (decl.parent?.selector ?? "").trim(),
        maxWidth,
        value: decl.value.trim(),
        order: order++,
      });
    });
  }
  return found;
}

test("no negative letter-spacing survives anywhere in ui/src", () => {
  for (const file of cssFiles()) {
    const root = postcss.parse(readFileSync(file, "utf8"), { from: file });
    root.walkDecls((decl) => {
      if (decl.prop.trim() !== "letter-spacing") return;
      const numeric = Number.parseFloat(decl.value);
      assert.ok(
        !(numeric < 0),
        "negative letter-spacing at " + normalize(file) + ":" + (decl.source?.start?.line ?? 0) + ": " + decl.value,
      );
    });
  }
});

test("no font-size or font shorthand scales with the viewport", () => {
  // The font shorthand carries a size too. Checking font-size alone reads green
  // while two hero declarations still scale.
  for (const file of cssFiles()) {
    const root = postcss.parse(readFileSync(file, "utf8"), { from: file });
    root.walkDecls((decl) => {
      if (!/^(font|font-size)$/.test(decl.prop)) return;
      assert.ok(
        !/\d\s*(vw|vh|vmin|vmax)\b/.test(decl.value),
        "viewport-scaled type at " + normalize(file) + ":" + (decl.source?.start?.line ?? 0) + ": " + decl.value,
      );
    });
  }
});

test("each ladder resolves to the fixed value at every checked width", () => {
  const decls = fontDecls();
  for (const ladder of LADDERS) {
    const rows = decls.filter((d) => d.selector === ladder.selector).sort((a, b) => a.order - b.order);
    assert.ok(rows.length > 0, "no font declaration found for " + ladder.selector);
    for (const width of WIDTHS) {
      // max-width queries of equal specificity resolve by source order, so the
      // last matching declaration wins.
      const matching = rows.filter((r) => r.maxWidth === null || width <= r.maxWidth);
      const winner = matching[matching.length - 1];
      assert.ok(winner, ladder.selector + " has no declaration at " + width);
      const px = Number.parseFloat((winner.value.match(/(\d+(?:\.\d+)?)px/) ?? [])[1] ?? "NaN");
      const step = ladder.steps.find((s) => s.maxWidth === null || width <= s.maxWidth);
      assert.equal(px, step?.px, ladder.selector + " at " + width + "px resolves to " + px + ", expected " + step?.px);
    }
  }
});

test("ladders never shrink as the viewport grows", () => {
  for (const ladder of LADDERS) {
    let previous = 0;
    for (let width = 320; width <= 1920; width++) {
      const step = ladder.steps.find((s) => s.maxWidth === null || width <= s.maxWidth);
      assert.ok(step, ladder.selector + " has no step for " + width);
      assert.ok(
        step!.px >= previous,
        ladder.selector + " shrinks at " + width + "px: " + previous + " -> " + step!.px,
      );
      previous = step!.px;
    }
  }
});

test("ladders stay within the deviation and jump ceilings", () => {
  for (const ladder of LADDERS) {
    const at = (w: number) => ladder.steps.find((s) => s.maxWidth === null || w <= s.maxWidth)!.px;
    let worstDeviation = 0;
    let worstAt = 0;
    let worstJump = 0;
    for (let width = 320; width <= 1920; width++) {
      // Two decimals, because the fluid segment of the old clamp is not integral.
      const deviation = Math.abs(ladder.baseline(width) - at(width));
      if (deviation > worstDeviation) { worstDeviation = deviation; worstAt = width; }
      if (width > 320) {
        const jump = at(width) - at(width - 1);
        if (jump > worstJump) worstJump = jump;
      }
    }
    assert.ok(
      Number(worstDeviation.toFixed(2)) <= ladder.maxDeviation,
      ladder.selector + " deviates " + worstDeviation.toFixed(2) + "px at " + worstAt + ", ceiling " + ladder.maxDeviation,
    );
    assert.ok(
      worstJump <= ladder.maxJump,
      ladder.selector + " jumps " + worstJump + "px, ceiling " + ladder.maxJump,
    );
  }
});

test("the settings header gives its flex item a min-width", () => {
  // The h2 sits inside a wrapper div, and that wrapper is the flex item. Putting
  // min-width on the h2 does not stop a long title from pushing the close button
  // out of the header.
  const css = readFileSync("ui/src/styles/canvas-viewer.css", "utf8");
  assert.match(css, /\.settings-header\s*>\s*div\s*\{[^}]*min-width:\s*0/);
});

test("the retired mark override inside the 768 query is gone", () => {
  // Leaving it would win over the new 1024 rule between 481 and 768 by source
  // order and break the ladder.
  const decls = fontDecls().filter((d) => d.selector === ".home-hero__mark");
  assert.ok(
    !decls.some((d) => d.maxWidth === 768),
    "the 768px mark override must be removed: " + JSON.stringify(decls),
  );
});
