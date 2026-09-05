import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import type { Root, Rule } from "../ui/node_modules/postcss/lib/postcss.js";

const read = (path: string) => readFileSync(path, "utf8");
const classic = read("ui/src/components/PromptComposer.tsx");
const home = read("ui/src/components/home/HomePromptComposer.tsx");
const negative = read("ui/src/components/NegativePromptField.tsx");
const mobile = read("ui/src/components/MobileComposeSheet.tsx");
const composerCss = read("ui/src/styles/progress-composer.css");
const homeCss = read("ui/src/styles/home-workspace.css");
const providerCss = read("ui/src/styles/provider-controls.css");
const panesCss = read("ui/src/styles/composer-panes.css");
const postcss = createRequire(import.meta.url)("../ui/node_modules/postcss") as {
  parse(source: string): Root;
};
const panes = postcss.parse(panesCss);
const desktop = "media (min-width: 801px)";
const mobileScope = "media (max-width: 800px)";
const containerScope = "container (max-width: 719px)";
function rules(root: Root, selector: string, scope = ""): Rule[] {
  const found: Rule[] = [];
  root.walkRules((rule) => {
    const ancestors: string[] = [];
    for (let parent: Rule["parent"] | Root["parent"] = rule.parent; parent; parent = parent.parent) {
      if (parent.type === "atrule") ancestors.unshift(`${parent.name} ${parent.params}`);
    }
    if (rule.selectors.includes(selector) && ancestors.join(" > ") === scope) found.push(rule);
  });
  return found;
}
function declaration(selector: string, prop: string, value: string, scope = "", important = false, root = panes) {
  const matches = rules(root, selector, scope).flatMap((rule) => rule.nodes)
    .filter((node) => node.type === "decl" && node.prop === prop);
  const actual = matches.at(-1);
  assert.ok(actual && actual.type === "decl", `${scope} ${selector}: missing ${prop}`);
  assert.equal(actual.value, value, `${scope} ${selector}: ${prop}`);
  assert.equal(Boolean(actual.important), important, `${scope} ${selector}: ${prop} importance`);
}
const locales = ["en", "ko", "zh-Hans", "zh-Hant"] as const;

test("nai conditionally activates dual prompt wrappers in classic and home", () => {
  assert.match(classic, /const isNai = provider === "nai"/);
  assert.match(classic, /isNai \? " composer__prompt-panes--dual" : ""/);
  assert.match(home, /isNai \? " home-prompt__panes--dual" : ""/);
  assert.match(negative, /if \(provider !== "nai"\) return null/);
  for (const selector of [".composer__prompt-panes", ".composer__prompt-pane", ".home-prompt__panes", ".home-prompt__pane"]) {
    declaration(selector, "display", "contents");
  }
});

test("the mobile sheet reuses PromptComposer instead of mounting a duplicate field", () => {
  assert.match(mobile, /<PromptComposer \/>/);
  assert.doesNotMatch(mobile, /NegativePromptField/);
  assert.match(classic, /<NegativePromptField variant="classic" onSubmit=\{submitPrompt\} \/>/);
  assert.match(home, /<NegativePromptField variant="home" onSubmit=\{submitPrompt\} \/>/);
});

test("dual panes share equal columns and stack below the 720px container boundary", () => {
  for (const selector of [".composer__prompt-panes--dual", ".home-prompt__panes--dual"]) {
    declaration(selector, "display", "grid");
    declaration(selector, "grid-template-columns", "repeat(2, minmax(0, 1fr))");
    declaration(selector, "grid-template-columns", "minmax(0, 1fr)", containerScope);
  }
  declaration(".negative-prompt--classic", "background", "var(--surface-2)");
  declaration(".negative-prompt--home .negative-prompt__textarea", "min-height", "168px");
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
const classicCss = read("ui/src/styles/classic-workspace.css");

test("sidebar dual panes give both textareas the same sizing reset with a usable floor", () => {
  const positive = ".composer--sidebar .composer__prompt-panes--dual .composer__textarea";
  const negative = ".composer--sidebar .composer__prompt-panes--dual .negative-prompt__textarea";
  assert.ok(rules(panes, positive, desktop).some((rule) => rule.selectors.includes(negative)), "one shared reset");
  for (const selector of [positive, negative]) {
    declaration(selector, "height", "100%", desktop, true);
    declaration(selector, "min-height", "72px", desktop);
    declaration(selector, "max-height", "none", desktop);
    declaration(selector, "flex", "1 1 auto", desktop);
  }
  declaration(".composer--sidebar .composer__textarea", "min-height", "0", desktop);
  declaration(".composer--sidebar .composer__textarea", "height", "100%", desktop, true);
});

test("sidebar dual grid keeps content-aware rows and shrinkable panes", () => {
  declaration(".composer--sidebar .composer__prompt-panes--dual", "grid-auto-rows", "minmax(min-content, 1fr)", desktop);
  declaration(".composer--sidebar .composer__prompt-panes--dual", "overflow-y", "auto", desktop);
  for (const child of [".composer__prompt-pane", ".negative-prompt"]) {
    declaration(`.composer--sidebar .composer__prompt-panes--dual > ${child}`, "min-height", "0", desktop);
  }
  declaration(".sidebar__scroll:has(> .composer--sidebar .composer__prompt-panes--dual)::after", "flex", "0 0 0", desktop, false, postcss.parse(sidebarCss));
});

test("classic negative textarea follows the composer max-height token in bottom and mobile variants", () => {
  declaration(".negative-prompt--classic .negative-prompt__textarea", "max-height", "var(--composer-textarea-max-height, none)");
  declaration(".negative-prompt--classic .negative-prompt__textarea", "resize", "none");
  declaration(".negative-prompt--classic .negative-prompt__textarea", "overflow-y", "auto");
  for (const child of [".composer__textarea", ".negative-prompt__textarea"]) {
    declaration(`.compose-sheet__panel--prompt ${child}`, "height", "100%", mobileScope, true);
    declaration(`.compose-sheet__panel--prompt ${child}`, "min-height", "160px", mobileScope);
    declaration(`.compose-sheet__panel--prompt ${child}`, "max-height", "none", mobileScope);
  }
});

test("bottom dock lets NAI dual panes scroll instead of pushing the toolbar out", () => {
  const host = postcss.parse(classicCss);
  declaration(".classic-workspace__dock:has(.composer__prompt-panes--dual)", "max-height", "min(52dvh, 420px)", "", false, host);
  declaration(".composer--bottom", "--composer-textarea-min-height", "86px", "", false, host);
  declaration(".composer--bottom", "--composer-textarea-max-height", "148px", "", false, host);
  for (const [prop, value] of Object.entries({ flex: "1 1 auto", "min-height": "0", "overflow-y": "auto", "grid-auto-rows": "minmax(min-content, auto)" })) {
    declaration(".composer--bottom .composer__prompt-panes--dual", prop, value);
  }
  for (const child of [".composer__prompt-pane", ".negative-prompt"]) {
    declaration(`.composer--bottom .composer__prompt-panes--dual > ${child}`, "min-height", "0");
  }
});

test("Home keeps its independent floors and the negative Home radius cascade", () => {
  for (const selector of [".home-prompt__textarea", ".negative-prompt--home .negative-prompt__textarea"]) {
    declaration(selector, "min-height", "168px");
    declaration(selector, "min-height", "144px", "media (max-width: 480px)");
  }
  declaration(".negative-prompt__textarea", "border-radius", "var(--r-sm)");
  declaration(".home-prompt__textarea", "border-radius", "var(--r-xl)");
  assert.ok(panesCss.indexOf(".negative-prompt__textarea {") < panesCss.indexOf(".home-prompt__textarea {"));
});

test("moved pane rules have one owner and one late import, without host or mirror migration", () => {
  const selectors = new Set<string>();
  panes.walkRules((rule) => { rule.selectors.forEach((selector) => selectors.add(selector)); });
  for (const old of [composerCss, providerCss, homeCss, classicCss, responsiveCss]) {
    postcss.parse(old).walkRules((rule) => {
      for (const selector of rule.selectors) assert.ok(!selectors.has(selector), `retired owner still defines ${selector}`);
    });
  }
  declaration(".composer__prompt-mirror", "pointer-events", "none", "", false, postcss.parse(composerCss));
  declaration(".composer__textarea", "z-index", "1");
  const main = read("ui/src/main.tsx");
  assert.equal(main.match(/import "\.\/styles\/composer-panes\.css"/g)?.length, 1);
  assert.ok(main.indexOf('import "./styles/composer-panes.css"') > main.indexOf('import "./styles/home-workspace.css"'));
  assert.ok(panesCss.split("\n").length < 400);
  assert.ok(composerCss.split("\n").length <= 500);
});

test("enabled guidance and identifying boundaries use the readable theme role", () => {
  for (const selector of [".composer__textarea", ".negative-prompt__textarea", ".home-prompt__textarea"]) {
    declaration(`${selector}:not(:disabled)::placeholder`, "color", "var(--text-muted)");
    declaration(`${selector}:not(:disabled)::placeholder`, "opacity", "1");
  }
  for (const selector of [".composer__prompt-panes--dual .composer__prompt-pane", ".negative-prompt--classic", ".home-prompt__textarea", ".negative-prompt--home .negative-prompt__textarea"]) {
    declaration(selector, "border", "1px solid var(--text-muted)");
  }
  // Runtime computed colors/alpha and screenshots, not this AST check, prove contrast.
});
