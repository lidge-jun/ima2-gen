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
