import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolveResultFavorite, toggleStarredTag } from "../ui/src/lib/favoriteState.ts";

const read = (path: string): string => readFileSync(path, "utf8");

describe("shared star surface controls", () => {
  it("prefers hydrated live history state and only falls back to the favorite set", () => {
    assert.equal(resolveResultFavorite("hero.png", [{ filename: "hero.png", isFavorite: true }], new Set()), true);
    assert.equal(resolveResultFavorite("hero.png", [{ filename: "hero.png", isFavorite: false }], new Set(["hero.png"])), false);
    assert.equal(resolveResultFavorite("archive.png", [], new Set(), true), true);
    assert.equal(resolveResultFavorite("hero.png", [], new Set(["hero.png"])), true);
    assert.equal(resolveResultFavorite(undefined, [], new Set(["hero.png"])), false);
  });

  it("changes only the starred tag and suppresses duplicates", () => {
    assert.deepEqual(toggleStarredTag(["portrait", "reviewed"], false), ["portrait", "reviewed", "starred"]);
    assert.deepEqual(toggleStarredTag(["starred", "portrait", "starred"], true), ["portrait"]);
  });

  it("uses one semantic SVG button with native keyboard activation and isolated events", () => {
    const control = read("ui/src/components/controls/FavoriteStarButton.tsx");
    assert.match(control, /type="button"/);
    assert.match(control, /aria-pressed=\{active\}/);
    assert.match(control, /aria-busy=\{busy \|\| undefined\}/);
    assert.match(control, /disabled=\{busy\}/);
    // The artwork moved into FavoriteStarIcon so the overlay button and the inline
    // list/dialog toggles cannot drift into two different stars. The requirement is
    // still "one decorative SVG, never a text glyph" — assert it where it now lives.
    assert.match(control, /<FavoriteStarIcon \/>/);
    const icon = read("ui/src/components/controls/FavoriteStarIcon.tsx");
    assert.match(icon, /<svg[\s\S]*aria-hidden="true"[\s\S]*focusable="false"/);
    assert.doesNotMatch(icon, /[★☆]/);
    assert.match(control, /onPointerDown=\{stopPointer\}/);
    assert.match(control, /onDoubleClick=\{stopMouse\}/);
    assert.match(control, /onKeyDown=\{stopKey\}/);
    assert.match(control, /event\.key === "Enter" \|\| event\.key === " "/);
    assert.doesNotMatch(control, /preventDefault/);
    assert.doesNotMatch(control, /[★☆]/);
  });

  it("wires the current result to favorite state with a per-file pending guard", () => {
    const canvas = read("ui/src/components/Canvas.tsx");
    assert.match(canvas, /resolveResultFavorite\([\s\S]*currentImage\?\.filename,[\s\S]*history,[\s\S]*galleryFavorites/);
    assert.match(canvas, /favoritePendingFilename === filename/);
    assert.match(canvas, /await toggleGalleryFavorite\(currentImage\)/);
    assert.match(canvas, /variant="result"/);
    assert.match(canvas, /galleryFavorites,[\s\S]*currentImage\?\.isFavorite/);
  });

  it("keeps Assets starring tag-owned, awaited, and failure-safe", () => {
    const grid = read("ui/src/components/assets/AssetsGrid.tsx");
    const store = read("ui/src/store/storeAssetsImpl.ts");
    assert.match(grid, /const starred = item\.tags\.includes\("starred"\)/);
    assert.match(grid, /if \(starPending\) return/);
    assert.match(grid, /const tags = toggleStarredTag\(item\.tags, starred\)/);
    assert.match(grid, /if \(!await updateAssetItem\(item\.id, \{ tags \}\)\)/);
    assert.match(grid, /variant="asset"/);
    assert.match(store, /updateAssetItemImpl[\s\S]*await updateAsset\(id, patch\)[\s\S]*set\(\(state\)/);
    assert.match(store, /activeTag && !asset\.tags\.includes\(activeTag\)/);
    assert.match(store, /assetsTags = \(await getAssetTags\(\)\)\.tags/);
    assert.doesNotMatch(grid, /toggleGalleryFavorite/);
  });

  it("reconciles session-gallery snapshots and blocks duplicate requests by filename", () => {
    const modal = read("ui/src/components/GalleryModal.tsx");
    const store = read("ui/src/store/storePromptImpl.ts");
    assert.match(modal, /favoritePendingRef\.current\.has\(filename\)/);
    assert.match(modal, /const isFavorite = await toggleGalleryFavorite\(item\)/);
    assert.match(modal, /setSessionGroups[\s\S]*entry\.filename === filename/);
    assert.match(modal, /setLoose[\s\S]*entry\.filename === filename/);
    assert.match(modal, /favoriteBusy=\{Boolean\(item\.filename && favoritePending\.has\(item\.filename\)\)\}/);
    assert.match(store, /currentImage: s\.currentImage\?\.filename === filename/);
    assert.match(store, /showToast\(t\("gallery\.favoriteFailed"\), true\)/);
  });

  it("places visible touch targets opposite destructive and drag controls", () => {
    const css = read("ui/src/styles/favorite-star.css");
    const gallery = read("ui/src/components/GalleryImageTile.tsx");
    assert.match(css, /\.favorite-star--result\s*\{[^}]*right:\s*8px/s);
    assert.match(css, /\.favorite-star--asset\s*\{[^}]*left:\s*7px/s);
    assert.match(css, /@media \(hover: none\), \(pointer: coarse\)[\s\S]*width:\s*44px[\s\S]*height:\s*44px/);
    assert.match(gallery, /<FavoriteStarButton[\s\S]*variant="gallery"/);
  });
});
