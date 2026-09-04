import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");
const classic = read("ui/src/components/PromptComposer.tsx");
const home = read("ui/src/components/home/HomePromptComposer.tsx");
const negative = read("ui/src/components/NegativePromptField.tsx");
const mobile = read("ui/src/components/MobileComposeSheet.tsx");
const composerCss = read("ui/src/styles/progress-composer.css");
const homeCss = read("ui/src/styles/home-workspace.css");
const providerCss = read("ui/src/styles/provider-controls.css");
const locales = ["en", "ko", "zh-Hans", "zh-Hant"] as const;

test("nai conditionally activates dual prompt wrappers in classic and home", () => {
  assert.match(classic, /const isNai = provider === "nai"/);
  assert.match(classic, /isNai \? " composer__prompt-panes--dual" : ""/);
  assert.match(home, /isNai \? " home-prompt__panes--dual" : ""/);
  assert.match(negative, /if \(provider !== "nai"\) return null/);
  assert.match(composerCss, /\.composer__prompt-panes,\s*\.composer__prompt-pane\s*\{\s*display:\s*contents;/);
  assert.match(homeCss, /\.home-prompt__panes,\s*\.home-prompt__pane\s*\{\s*display:\s*contents;/);
});

test("the mobile sheet reuses PromptComposer instead of mounting a duplicate field", () => {
  assert.match(mobile, /<PromptComposer \/>/);
  assert.doesNotMatch(mobile, /NegativePromptField/);
  assert.match(classic, /<NegativePromptField variant="classic" onSubmit=\{submitPrompt\} \/>/);
  assert.match(home, /<NegativePromptField variant="home" onSubmit=\{submitPrompt\} \/>/);
});

test("dual panes share equal columns and stack below the 720px container boundary", () => {
  assert.match(composerCss, /\.composer__prompt-panes--dual\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(homeCss, /\.home-prompt__panes--dual\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(composerCss, /@container \(max-width: 719px\)\s*\{[\s\S]*?\.composer__prompt-panes--dual\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(homeCss, /@container \(max-width: 719px\)\s*\{[\s\S]*?\.home-prompt__panes--dual\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(providerCss, /\.negative-prompt--classic/);
  assert.match(providerCss, /\.negative-prompt--home/);
});

test("both panes expose labels, descriptions, and the same submit shortcut", () => {
  assert.match(classic, /htmlFor=\{`positive-prompt-\$\{variant\}`\}/);
  assert.match(classic, /aria-describedby=\{isNai \? `positive-prompt-\$\{variant\}-hint` : undefined\}/);
  assert.match(home, /aria-describedby=\{isNai \? "home-prompt-hint" : undefined\}/);
  assert.match(negative, /aria-describedby=\{hintId\}/);
  assert.match(negative, /htmlFor=\{id\}/);
  assert.match(negative, /onSubmit\(\)/);
  for (const source of [classic, home, negative]) {
    assert.match(source, /\.metaKey/);
    assert.match(source, /\.ctrlKey/);
  }
  assert.match(home, /onClick=\{submitPrompt\}/);
});

test("mention parsing remains exclusive to the classic positive pane", () => {
  assert.match(classic, /findMentionAtCaret/);
  assert.match(classic, /textareaRef=\{textareaRef\}/);
  assert.doesNotMatch(negative, /findMentionAtCaret|ElementMentionMenu|MentionQuery/);
});

test("all current locale dictionaries provide labels, placeholders, and character hints", () => {
  for (const locale of locales) {
    const dictionary = JSON.parse(read(`ui/src/i18n/${locale}.json`));
    for (const pane of ["positivePrompt", "negativePrompt"] as const) {
      assert.equal(typeof dictionary.nai[pane].label, "string", `${locale} ${pane} label`);
      assert.equal(typeof dictionary.nai[pane].placeholder, "string", `${locale} ${pane} placeholder`);
      assert.match(dictionary.nai[pane].hint, /\{count\}/, `${locale} ${pane} count`);
    }
  }
});

// Regression (260905): the sidebar min-height token (clamp(200px, 42vh, 520px))
// leaked into the negative textarea, which had no counterpart to the positive
// pane's sizing reset. The pane then overflowed the dual grid and sat on top
// of the toolbar. Both textareas must share one reset scoped to the dual grid,
// the grid must keep content-aware rows, and the sidebar spacer must yield.
const sidebarCss = read("ui/src/styles/sidebar.css");
const responsiveCss = read("ui/src/styles/responsive-layout.css");
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const desktopBlock = (css: string) =>
  stripComments(css).match(/@media \(min-width: 801px\)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/)?.[1] ?? "";

test("sidebar dual panes give both textareas the same sizing reset with a usable floor", () => {
  const desktop = desktopBlock(composerCss);
  const reset = desktop.match(
    /\.composer--sidebar \.composer__prompt-panes--dual \.composer__textarea,\s*\.composer--sidebar \.composer__prompt-panes--dual \.negative-prompt__textarea\s*\{([^{}]*)\}/,
  );
  assert.ok(reset, "dual-pane textarea reset must cover positive and negative together");
  for (const declaration of [
    /height:\s*100%\s*!important/,
    /min-height:\s*72px/,
    /max-height:\s*none/,
    /flex:\s*1 1 auto/,
  ]) {
    assert.match(reset[1], declaration);
  }
  // The single-pane reset stays untouched so non-NAI lanes keep their geometry.
  assert.match(desktop, /\.composer--sidebar \.composer__textarea\s*\{[^{}]*min-height:\s*0;/);
});

test("sidebar dual grid keeps content-aware rows and shrinkable panes", () => {
  const desktop = desktopBlock(composerCss);
  assert.match(
    desktop,
    /\.composer--sidebar \.composer__prompt-panes--dual\s*\{[^{}]*grid-auto-rows:\s*minmax\(min-content, 1fr\);[^{}]*overflow-y:\s*auto;/,
  );
  assert.match(
    desktop,
    /\.composer--sidebar \.composer__prompt-panes--dual > \.composer__prompt-pane,\s*\.composer--sidebar \.composer__prompt-panes--dual > \.negative-prompt\s*\{\s*min-height:\s*0;/,
  );
  assert.match(
    desktopBlock(sidebarCss),
    /\.sidebar__scroll:has\(> \.composer--sidebar \.composer__prompt-panes--dual\)::after\s*\{\s*flex:\s*0 0 0;/,
  );
});

test("classic negative textarea follows the composer max-height token in bottom and mobile variants", () => {
  assert.match(
    providerCss,
    /\.negative-prompt--classic \.negative-prompt__textarea\s*\{[^{}]*max-height:\s*var\(--composer-textarea-max-height, none\);[^{}]*resize:\s*none;[^{}]*overflow-y:\s*auto;/,
  );
  assert.match(
    stripComments(responsiveCss),
    /\.compose-sheet__panel--prompt \.composer__textarea,\s*\.compose-sheet__panel--prompt \.negative-prompt__textarea\s*\{[^{}]*height:\s*100% !important;/,
  );
});

test("bottom dock lets NAI dual panes scroll instead of pushing the toolbar out", () => {
  const classicCss = stripComments(read("ui/src/styles/classic-workspace.css"));
  assert.match(
    classicCss,
    /\.classic-workspace__dock:has\(\.composer__prompt-panes--dual\)\s*\{\s*max-height:\s*min\(52dvh, 420px\);/,
  );
  assert.match(
    classicCss,
    /\.composer--bottom \.composer__prompt-panes--dual\s*\{[^{}]*flex:\s*1 1 auto;[^{}]*min-height:\s*0;[^{}]*overflow-y:\s*auto;[^{}]*grid-auto-rows:\s*minmax\(min-content, auto\);/,
  );
  assert.match(
    classicCss,
    /\.composer--bottom \.composer__prompt-panes--dual > \.composer__prompt-pane,\s*\.composer--bottom \.composer__prompt-panes--dual > \.negative-prompt\s*\{\s*min-height:\s*0;/,
  );
});
