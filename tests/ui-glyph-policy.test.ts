import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";

// WP3 (devlog/_plan/260726_zero-backlog-frontend-qa/030_icon_copy_cleanup.md):
// text glyphs must not stand in for UI icons. They render differently per font, and a
// screen reader announces "white star" instead of the action. The mechanical check is
// dingbat count; whether each replacement *means* the right thing stays a review call
// (ImageNode's glyph turned out to be a save trigger, not a favorite toggle).

const DINGBAT_STARS = /[\u2605\u2606\u2726-\u2734]/u;
// Pencil/check dingbats used as affordances. `×` (U+00D7) is excluded on purpose: it is
// the established close mark across this codebase and reads correctly in every font.
const DINGBAT_ACTIONS = /[\u270E\u2713\u2714\u2717\u2718]/u;

function componentFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return componentFiles(full);
    return /\.(tsx|ts)$/.test(full) ? [full] : [];
  });
}

test("no dingbat star glyphs are used as UI icons", () => {
  const offenders = componentFiles("ui/src/components").filter((file) =>
    DINGBAT_STARS.test(readFileSync(file, "utf8")),
  );
  assert.deepEqual(offenders, [], `dingbat glyphs found in: ${offenders.join(", ")}`);
});

test("no pencil or check dingbats stand in for action icons", () => {
  // A text glyph renders at a different weight per font fallback and a screen reader
  // announces it as "lower right pencil" instead of the action.
  const offenders = componentFiles("ui/src/components")
    .filter((file) => DINGBAT_ACTIONS.test(readFileSync(file, "utf8")))
    .map((file) => file.split(sep).join("/"));
  assert.deepEqual(offenders, [], `dingbat action glyphs found in: ${offenders.join(", ")}`);
});

test("edit and check marks come from one shared icon each", () => {
  const files = componentFiles("ui/src/components");
  for (const [name, marker] of [
    ["EditIcon", "M4 20h4l10-10a2.5 2.5 0"],
    ["CheckIcon", "m5 12.5 4.5 4.5L19 7"],
  ] as const) {
    const owners = files
      .filter((file) => readFileSync(file, "utf8").includes(marker))
      .map((file) => file.split(sep).join("/"));
    assert.deepEqual(
      owners,
      [`ui/src/components/controls/${name}.tsx`],
      `${name} artwork must have exactly one definition`,
    );
  }
});

test("the favorite star artwork has exactly one definition", () => {
  const files = componentFiles("ui/src/components");
  const starPath = "m12 2.75 2.78 5.63";
  // Compare with forward slashes: `join` yields backslashes on Windows.
  const owners = files
    .filter((file) => readFileSync(file, "utf8").includes(starPath))
    .map((file) => file.split(sep).join("/"));
  assert.deepEqual(
    owners,
    ["ui/src/components/controls/FavoriteStarIcon.tsx"],
    "the star path must live only in FavoriteStarIcon",
  );
});

test("favorite toggles share the single icon and expose pressed state", () => {
  for (const path of [
    "ui/src/components/PromptDetailModal.tsx",
    "ui/src/components/PromptLibraryRow.tsx",
  ]) {
    const src = readFileSync(path, "utf8");
    assert.match(src, /<FavoriteStarIcon \/>/, `${path} must render the shared icon`);
    assert.match(src, /aria-pressed=\{prompt\.isFavorite\}/, `${path} must expose toggle state`);
  }
});

test("the node save button uses save semantics, not a favorite star", () => {
  const src = readFileSync("ui/src/components/ImageNode.tsx", "utf8");
  // aria-label is promptLibrary.saveTitle, so the glyph must not read as "favorite".
  assert.match(src, /aria-haspopup="dialog"/, "it opens a popover; say so");
  assert.match(src, /aria-expanded=\{saveOpen\}/, "popover state must be exposed");
  assert.doesNotMatch(src, /FavoriteStarIcon/, "a favorite star would misstate the action");
});

test("toast dismiss is localized and icon-based", () => {
  const src = readFileSync("ui/src/components/Toast.tsx", "utf8");
  assert.doesNotMatch(src, /aria-label="Dismiss notification"/, "must not hardcode English");
  assert.match(src, /aria-label=\{t\("common\.dismiss"\)\}/);

  for (const locale of ["ko", "en"]) {
    const dict = JSON.parse(readFileSync(`ui/src/i18n/${locale}.json`, "utf8"));
    assert.ok(dict.common?.dismiss, `${locale}.common.dismiss missing`);
  }
  const ko = JSON.parse(readFileSync("ui/src/i18n/ko.json", "utf8"));
  assert.doesNotMatch(ko.common.dismiss, /^[\x00-\x7F]+$/, "Korean label must be Korean");
});
