import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("gallery navigation UX contract", () => {
  it("navigates focused generated images with arrow keys only on the viewer itself", () => {
    const canvas = readSource("ui/src/components/Canvas.tsx");
    const domEvents = readSource("ui/src/lib/domEvents.ts");
    const ko = readSource("ui/src/i18n/ko.json");
    const en = readSource("ui/src/i18n/en.json");
    const css = readSource("ui/src/index.css");

    assert.match(canvas, /isEditableTarget/);
    assert.match(canvas, /selectHistory/);
    assert.doesNotMatch(canvas, /selectImage/);
    assert.match(canvas, /event\.key !== "ArrowLeft" && event\.key !== "ArrowRight"/);
    assert.match(canvas, /event\.target !== event\.currentTarget/);
    assert.match(canvas, /tabIndex=\{0\}/);
    assert.match(canvas, /className="result-container visible"/);
    assert.match(canvas, /aria-label=\{t\("canvas\.imageViewerAria"\)\}/);
    assert.match(domEvents, /HTMLInputElement/);
    assert.match(domEvents, /HTMLTextAreaElement/);
    assert.match(domEvents, /HTMLSelectElement/);
    assert.match(domEvents, /isContentEditable/);
    assert.match(css, /\.result-container:focus-visible/);
    assert.match(ko, /imageViewerAria/);
    assert.match(en, /imageViewerAria/);
  });

  it("restores Gallery position by selected item with scrollTop fallback", () => {
    const gallery = readSource("ui/src/components/GalleryModal.tsx");
    const imageTile = readSource("ui/src/components/GalleryImageTile.tsx");
    const navigation = readSource("ui/src/lib/galleryNavigation.ts");
    const lineCount = gallery.split("\n").length;

    assert.ok(lineCount < 500, `GalleryModal.tsx should stay under 500 lines, got ${lineCount}`);
    assert.match(gallery, /useLayoutEffect/);
    assert.match(gallery, /useRef/);
    assert.match(gallery, /scrollRef/);
    assert.match(gallery, /itemRefs/);
    assert.match(gallery, /Record<string, HTMLElement \| null>/);
    assert.match(gallery, /lastScrollTopRef/);
    assert.match(gallery, /getGalleryItemKey/);
    assert.match(gallery, /scrollIntoView\(\{ block: "center" \}\)/);
    assert.match(gallery, /lastScrollTopRef\.current/);
    assert.match(gallery, /totalVisible/);
    assert.match(gallery, /sessionGroups\.length/);
    assert.match(gallery, /loose\.length/);
    assert.match(gallery, /dateGroups\.length/);
    assert.match(gallery, /GalleryImageTile/);
    assert.match(imageTile, /itemRef: \(node: HTMLElement \| null\) => void/);
    assert.match(imageTile, /onSelect: \(item: GenerateItem\) => void/);
    assert.match(navigation, /export function getGalleryItemKey/);
  });

  it("maps vertical wheel input to horizontal thumbnail scrolling safely", () => {
    const wheel = readSource("ui/src/lib/horizontalWheel.ts");
    const historyStrip = readSource("ui/src/components/HistoryStrip.tsx");
    const cardDeck = readSource("ui/src/components/card-news/CardDeckRail.tsx");
    const css = readSource("ui/src/index.css");

    assert.match(wheel, /scrollWidth <= el\.clientWidth/);
    assert.match(wheel, /Math\.abs\(event\.deltaY\) > Math\.abs\(event\.deltaX\)/);
    assert.match(wheel, /atStart/);
    assert.match(wheel, /atEnd/);
    assert.match(wheel, /preventDefault\(\)/);
    assert.match(wheel, /scrollLeft \+= event\.deltaY/);
    assert.match(historyStrip, /onWheel=\{handleHorizontalWheel\}/);
    assert.match(cardDeck, /onWheel=\{handleHorizontalWheel\}/);
    assert.match(css, /\.history-strip[\s\S]*overscroll-behavior-inline: contain/);
    assert.match(css, /\.card-news-deck[\s\S]*overscroll-behavior-inline: contain/);
  });

  it("renders the compact gallery strip as an adaptive app-level rail", () => {
    const app = readSource("ui/src/App.tsx");
    const sidebar = readSource("ui/src/components/Sidebar.tsx");
    const historyStrip = readSource("ui/src/components/HistoryStrip.tsx");
    const css = readSource("ui/src/index.css");
    const appRule = /\.app\s*\{[^}]*\}/s.exec(css)?.[0] ?? "";
    const historyRule = /\.history-strip\s*\{[^}]*\}/s.exec(css)?.[0] ?? "";
    const addRule = /\.history-thumb--add\s*\{[^}]*\}/s.exec(css)?.[0] ?? "";
    const responsiveBlock = /@media \(max-width:\s*800px\)\s*\{[\s\S]*?\.canvas\s*\{/s.exec(css)?.[0] ?? "";

    assert.match(app, /import \{ HistoryStrip \} from "\.\/components\/HistoryStrip"/);
    assert.match(app, /<Sidebar \/>\s*<HistoryStrip \/>/);
    assert.doesNotMatch(sidebar, /HistoryStrip/);

    assert.match(appRule, /--gallery-rail-w:\s*clamp\(72px,\s*7vw,\s*112px\)/);
    assert.match(appRule, /grid-template-columns:\s*260px var\(--gallery-rail-w\) minmax\(0,\s*1fr\) auto/);
    assert.match(historyRule, /flex-direction:\s*column/);
    assert.match(historyRule, /overflow-y:\s*auto/);
    assert.match(historyRule, /overflow-x:\s*hidden/);
    assert.match(addRule, /top:\s*0/);

    assert.match(responsiveBlock, /grid-template-rows:\s*auto auto 1fr/);
    assert.match(responsiveBlock, /\.history-strip\s*\{[\s\S]*flex-direction:\s*row/);
    assert.match(responsiveBlock, /\.history-strip\s*\{[\s\S]*overflow-x:\s*auto/);
    assert.match(responsiveBlock, /\.history-thumb--add\s*\{[\s\S]*left:\s*0/);

    assert.match(historyStrip, /useRef<Record<string,\s*HTMLImageElement \| null>>/);
    assert.match(historyStrip, /function getHistoryItemKey\(item: GenerateItem\): string/);
    assert.match(historyStrip, /scrollIntoView\(\{ block: "nearest", inline: "nearest" \}\)/);
    assert.match(historyStrip, /ref=\{\(node\) => \{/);
  });

  it("does not introduce backend coupling for navigation UX", () => {
    const routes = readSource("routes/history.js");
    const test = readSource("tests/gallery-navigation-ux-contract.test.js");

    assert.doesNotMatch(routes, /galleryNavigation/);
    assert.match(test, /does not introduce backend coupling/);
  });
});
