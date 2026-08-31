import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { createRequire } from "node:module";

// wp2 (devlog/_plan/260831_ui_polish_round/010_wp2_radius_scale.md): every
// border-radius in ui/src resolves through one of eight scale tokens defined in
// exactly one place. A name-only check would pass a wrong token on a right
// selector, so the oracle is a frozen per-declaration manifest instead.
//
// postcss lives in ui/node_modules, not the root tree. Several contracts here
// already read the ui tree directly (typescript, @types/react), so this follows
// that precedent rather than adding a root dependency for one test.
const require = createRequire(import.meta.url);
type PostcssNode = {
  type: string;
  name?: string;
  params?: string;
  selector?: string;
  parent?: PostcssNode;
};
type PostcssDecl = PostcssNode & {
  prop: string;
  value: string;
  important?: boolean;
  source?: { start?: { line: number } };
};
type PostcssRoot = {
  walkDecls(cb: (decl: PostcssDecl) => void): void;
  walkAtRules(name: string, cb: (rule: { params: string }) => void): void;
};
const postcss = require("../ui/node_modules/postcss") as {
  parse(css: string, opts?: { from?: string }): PostcssRoot;
};

type RadiusRow = {
  file: string;
  atRule: string | null;
  selector: string;
  expected: string;
  important: boolean;
};

const MANIFEST: RadiusRow[] = JSON.parse(
  readFileSync("tests/fixtures/contracts/radius-scale.manifest.json", "utf8"),
);

const SCALE = {
  "--r-xs": "4px",
  "--r-sm": "6px",
  "--r-md": "8px",
  "--r-lg": "10px",
  "--r-xl": "12px",
  "--r-2xl": "16px",
  "--r-3xl": "20px",
  "--r-pill": "999px",
} as const;

const RADIUS_LONGHANDS = [
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-left-radius",
  "border-bottom-right-radius",
  "border-start-start-radius",
  "border-start-end-radius",
  "border-end-start-radius",
  "border-end-end-radius",
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

function tsFiles(dir = "ui/src"): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsFiles(path));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(path);
  }
  return out.sort();
}

function normalize(path: string): string {
  return path.split(sep).join("/");
}

type Decl = {
  file: string;
  line: number;
  prop: string;
  value: string;
  important: boolean;
  atRule: string | null;
  selector: string;
};

function radiusDecls(): Decl[] {
  const found: Decl[] = [];
  for (const file of cssFiles()) {
    const root = postcss.parse(readFileSync(file, "utf8"), { from: file });
    root.walkDecls((decl) => {
      if (!/radius/i.test(decl.prop)) return;
      let atRule: string | null = null;
      let parent: PostcssNode | undefined = decl.parent;
      while (parent) {
        if (parent.type === "atrule") {
          atRule = String(parent.name) + " " + String(parent.params);
          break;
        }
        parent = parent.parent;
      }
      found.push({
        file: normalize(file),
        line: decl.source?.start?.line ?? 0,
        prop: decl.prop.toLowerCase(),
        value: decl.value.trim(),
        important: Boolean(decl.important),
        atRule,
        selector: decl.parent?.selector ?? "",
      });
    });
  }
  return found;
}

function keyOf(row: { file: string; atRule: string | null; selector: string }): string {
  return [row.file, row.atRule ?? "", row.selector].join("||");
}

test("the frozen manifest covers every border-radius declaration exactly once", () => {
  const decls = radiusDecls().filter((d) => d.prop === "border-radius");
  assert.equal(MANIFEST.length, 476, "the manifest is frozen at 476 rows");
  assert.equal(decls.length, MANIFEST.length, "declaration count drifted from the manifest");

  const manifestKeys = new Set(MANIFEST.map(keyOf));
  assert.equal(manifestKeys.size, MANIFEST.length, "manifest keys must be unique");

  const seen = new Set<string>();
  for (const decl of decls) {
    const key = keyOf(decl);
    assert.ok(!seen.has(key), "duplicate declaration key: " + key);
    seen.add(key);
    assert.ok(manifestKeys.has(key), "border-radius not in the frozen manifest: " + decl.file + ":" + decl.line);
  }
  for (const row of MANIFEST) {
    assert.ok(seen.has(keyOf(row)), "manifest row no longer present in CSS: " + keyOf(row));
  }
});

test("each declaration carries exactly the mapped token and !important flag", () => {
  const byKey = new Map(radiusDecls().filter((d) => d.prop === "border-radius").map((d) => [keyOf(d), d]));
  for (const row of MANIFEST) {
    const decl = byKey.get(keyOf(row));
    assert.ok(decl, "missing declaration for " + keyOf(row));
    // Character-exact: a valid-but-wrong scale token on the right selector is the
    // failure mode a name-only check cannot see.
    assert.equal(decl!.value, row.expected, "wrong radius value at " + decl!.file + ":" + decl!.line);
    // postcss keeps !important out of decl.value, so comparing values alone would
    // let a deleted !important pass.
    assert.equal(decl!.important, row.important, "!important drifted at " + decl!.file + ":" + decl!.line);
  }
});

test("the eight scale tokens hold their values and are defined exactly once", () => {
  const definitions = new Map<string, { file: string; line: number; value: string; selector: string }[]>();
  for (const file of cssFiles()) {
    const root = postcss.parse(readFileSync(file, "utf8"), { from: file });
    root.walkDecls((decl) => {
      const prop = decl.prop.trim();
      if (!(prop in SCALE)) return;
      const list = definitions.get(prop) ?? [];
      list.push({
        file: normalize(file),
        line: decl.source?.start?.line ?? 0,
        value: decl.value.trim(),
        selector: (decl.parent as any)?.selector ?? "",
      });
      definitions.set(prop, list);
    });
  }
  for (const [token, expected] of Object.entries(SCALE)) {
    const list = definitions.get(token) ?? [];
    // Value-only assertions are bypassable by a scoped redefinition such as
    // .modal { --r-lg: 999px }, which leaves both :root and the manifest intact.
    assert.equal(list.length, 1, token + " must be defined exactly once, found " + list.length);
    assert.equal(list[0].file, "ui/src/index.css", token + " must live in ui/src/index.css");
    assert.equal(list[0].selector, ":root", token + " must be defined on the plain :root block");
    assert.equal(list[0].value, expected, token + " must stay " + expected);
  }
});

test("no radius longhand, vendor prefix, or @property registration exists", () => {
  // A prefixed longhand such as -webkit-border-top-left-radius overrides the
  // standard shorthand in Chrome (reproduced: border-radius 6px followed by
  // -webkit-border-top-left-radius 999px computes to 999px), and it appears in
  // neither the standard-longhand nor the prefixed-shorthand list. Strip the
  // prefix first, then compare against the standard names, so any current or
  // future vendor spelling of a radius longhand is refused.
  for (const decl of radiusDecls()) {
    const bare = decl.prop.replace(/^-(webkit|moz|ms|o)-/, "");
    assert.ok(
      !RADIUS_LONGHANDS.includes(bare),
      "radius longhand overrides the shorthand: " + decl.file + ":" + decl.line + " " + decl.prop,
    );
    assert.ok(
      bare === decl.prop,
      "prefixed radius overrides the shorthand: " + decl.file + ":" + decl.line + " " + decl.prop,
    );
  }
  for (const file of cssFiles()) {
    const root = postcss.parse(readFileSync(file, "utf8"), { from: file });
    root.walkAtRules("property", (rule) => {
      // @property initial-value can change the computed value while :root still
      // reads correct.
      assert.ok(
        !/^--r-/.test(rule.params.trim()),
        "@property must not register a radius token: " + normalize(file) + " " + rule.params,
      );
    });
  }
});

test("stylesheet imports stay inside the audited ui/src tree", () => {
  // The manifest only covers ui/src/**/*.css. An @import pointing at a URL or at
  // a path outside that tree would ship radius the contract never parsed.
  for (const file of cssFiles()) {
    const root = postcss.parse(readFileSync(file, "utf8"), { from: file });
    root.walkAtRules("import", (rule) => {
      const target = rule.params.trim().replace(/^(url\()?["']?/, "").replace(/["']?\)?$/, "");
      if (target === "tailwindcss") return; // package entry, resolved by the bundler
      assert.ok(
        target.startsWith("./") || target.startsWith("styles/"),
        "@import must stay inside ui/src: " + normalize(file) + " -> " + target,
      );
      assert.ok(
        !target.includes(".."),
        "@import must not escape ui/src: " + normalize(file) + " -> " + target,
      );
    });
  }
});

test("the HTML shell carries no radius of its own", () => {
  // index.html sits outside ui/src, so a <style> block or a style attribute there
  // would never reach the manifest.
  const html = readFileSync("ui/index.html", "utf8");
  const withoutFavicon = html.replace(/href="data:image\/svg\+xml[^"]*"/g, "");
  assert.ok(!/<style[\s>]/i.test(withoutFavicon), "index.html must not carry a <style> block");
  assert.ok(!/\sstyle=/i.test(withoutFavicon), "index.html must not carry inline style attributes");
  assert.ok(
    !/border[a-z-]*radius/i.test(withoutFavicon),
    "index.html must not declare radius outside the audited tree",
  );
});

test("the retired radius tokens and calc pattern are gone", () => {
  for (const file of cssFiles()) {
    const css = readFileSync(file, "utf8");
    const rel = normalize(file);
    assert.ok(!/--radius\b/.test(css), "--radius must not return: " + rel);
    assert.ok(!/--radius-(md|lg)\b/.test(css), "undefined --radius-* refs must not return: " + rel);
    assert.ok(!/--agent-r-(sm|md|lg)\b/.test(css), "agent-local radius scale must not return: " + rel);
    assert.ok(!/calc\(\s*var\(--r/.test(css), "calc offsets off the scale must not return: " + rel);
  }
});

test("every radius token reference resolves to a defined scale token", () => {
  const defined = new Set(Object.keys(SCALE));
  for (const decl of radiusDecls()) {
    for (const ref of decl.value.match(/--[a-zA-Z0-9-]+/g) ?? []) {
      assert.ok(defined.has(ref), "undefined radius token " + ref + " at " + decl.file + ":" + decl.line);
    }
  }
});

test("TS and TSX carry exactly one allowlisted radius property", () => {
  // The earlier regex only matched double-quoted values, so borderRadius: '999px',
  // borderRadius: 999, a template literal, and WebkitBorderRadius all slipped past
  // (audit wp2c1-F1). Walk the TypeScript AST and key on the property NAME, which
  // makes the check independent of how the value is spelled.
  const ts = require("../ui/node_modules/typescript") as typeof import("typescript");
  const ALLOWED = new Map([["ui/src/components/settings/QuotaCard.tsx", 'borderRadius: "var(--r-sm)"']]);
  const hits: { file: string; text: string }[] = [];

  for (const file of tsFiles()) {
    const source = readFileSync(file, "utf8");
    const rel = normalize(file);
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

    const visit = (node: import("typescript").Node): void => {
      if (ts.isPropertyAssignment(node)) {
        const name = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : "";
        // Covers borderRadius, borderTopLeftRadius, WebkitBorderRadius, and the
        // custom-property form "--r-lg".
        if (/^([A-Za-z]*[Bb]order[A-Za-z]*Radius)$/.test(name) || /^--r-/.test(name)) {
          hits.push({ file: rel, text: name + ": " + node.initializer.getText(sourceFile) });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);

    // setProperty is the other inline route; ElementReferenceNode.tsx already
    // passes custom properties inline, so the bypass is real here.
    assert.ok(
      !/setProperty\(\s*["'`](--r-|border[a-zA-Z-]*radius)/i.test(source),
      "radius must not be set from script: " + rel,
    );
    // A CSS string assembled in TS bypasses the postcss walk entirely.
    assert.ok(
      !/(cssText|innerHTML|insertRule)[\s\S]{0,120}border[a-z-]*radius/i.test(source),
      "radius CSS must not be injected from script: " + rel,
    );
  }

  assert.equal(hits.length, ALLOWED.size, "unexpected radius properties in TS/TSX: " + JSON.stringify(hits));
  for (const hit of hits) {
    assert.equal(ALLOWED.get(hit.file), hit.text, "radius property not allowlisted in " + hit.file);
  }
});

test("no raw px or bare-number radius survives in CSS", () => {
  for (const decl of radiusDecls()) {
    if (decl.prop !== "border-radius") continue;
    const allowed = /^(0|inherit|[\d.]+%|(\d+(\.\d+)?% ?)+|0 0 0 0)$/.test(decl.value) || decl.value.includes("var(--r-");
    assert.ok(allowed, "off-scale radius value at " + decl.file + ":" + decl.line + ": " + decl.value);
    assert.ok(
      !/(^|\s)\d+(\.\d+)?px/.test(decl.value),
      "raw px radius at " + decl.file + ":" + decl.line + ": " + decl.value,
    );
  }
});
