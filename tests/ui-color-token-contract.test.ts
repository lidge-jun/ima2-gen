import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const UI_SRC = join(import.meta.dirname, "..", "ui", "src");
const STYLES_DIR = join(UI_SRC, "styles");
const INDEX_CSS = join(UI_SRC, "index.css");

/** Recursively collect all CSS files under a directory. */
function collectCss(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectCss(full));
    else if (entry.name.endsWith(".css")) out.push(full);
  }
  return out;
}

/** Collect all CSS + TSX/JSX files that may contain color refs. */
function collectAll(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectAll(full, exts));
    else if (exts.some(e => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

const cssFiles = [INDEX_CSS, ...collectCss(STYLES_DIR)];
const allFiles = [...cssFiles, ...collectAll(join(UI_SRC, "components"), [".css", ".tsx", ".jsx"])];

/** Extract all var(--name) references from a file, returning {name, file, line}. */
function extractVarRefs(file: string) {
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");
  const refs: { name: string; file: string; line: number; hasFallback: boolean }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const matches = lines[i].matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g);
    for (const m of matches) {
      refs.push({ name: m[1], file, line: i + 1, hasFallback: false });
    }
  }
  return refs;
}

/** Extract all custom property definitions from index.css. */
function extractDefinitions(file: string): Set<string> {
  const content = readFileSync(file, "utf8");
  const defs = new Set<string>();
  for (const m of content.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)) {
    defs.add(m[1]);
  }
  return defs;
}

// Runtime-injected tokens that are set via JS, not CSS definitions
const RUNTIME_INJECTED = new Set([
  "--element-thumb",
  "--folder-depth",
  "--inflight-caret-top",
  "--node-preview-h",
  "--node-preview-w",
]);

// Deleted aliases that must not reappear
const DELETED_ALIASES = [
  "--bg-primary", "--bg-raised", "--danger", "--error",
  "--success", "--warn", "--warning", "--info",
  "--shadow", "--agent-rail-ring", "--text-primary",
];

// State color hex literals that should now be tokens
const STATE_COLOR_LITERALS = [
  "#ff6262", "#e05555", "#e53935", "#ff6b6b", "#ff9c9c",
  "#fecaca",
  "#d9a12e", "#d08c3a", "#4caf50", "#3b82f6",
];

describe("ui-color-token-contract", () => {
  const definitions = new Set<string>();
  for (const file of cssFiles) {
    for (const name of extractDefinitions(file)) {
      definitions.add(name);
    }
  }
  const allRefs = allFiles.flatMap(f => extractVarRefs(f));

  it("has zero reachable undefined token references", () => {
    const undefined_refs = allRefs.filter(
      r => !definitions.has(r.name) && !RUNTIME_INJECTED.has(r.name)
    );
    const unique = [...new Set(undefined_refs.map(r => r.name))];
    assert.deepStrictEqual(
      unique,
      [],
      `Undefined token references found:\n${undefined_refs
        .map(r => `  ${relative(UI_SRC, r.file)}:${r.line} ${r.name}`)
        .join("\n")}`
    );
  });

  it("has zero state-color hex literals in scope files", () => {
    const hits: string[] = [];
    for (const file of allFiles) {
      const content = readFileSync(file, "utf8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const lower = lines[i].toLowerCase();
        for (const hex of STATE_COLOR_LITERALS) {
          if (lower.includes(hex.toLowerCase())) {
            hits.push(`${relative(UI_SRC, file)}:${i + 1} ${hex}`);
          }
        }
      }
    }
    assert.deepStrictEqual(hits, [], `State color literals found:\n${hits.join("\n")}`);
  });

  it("has zero deleted alias names in var() references", () => {
    const aliasRefs = allRefs.filter(r => DELETED_ALIASES.includes(r.name));
    assert.deepStrictEqual(
      aliasRefs.map(r => `${relative(UI_SRC, r.file)}:${r.line} ${r.name}`),
      [],
      "Deleted aliases still referenced"
    );
  });

  it("sidebar.css:58 references var(--chrome) not an inline gradient", () => {
    const content = readFileSync(join(STYLES_DIR, "sidebar.css"), "utf8");
    assert.ok(
      !content.includes("linear-gradient(180deg, #ffffff"),
      "sidebar.css still has inline chrome gradient instead of var(--chrome)"
    );
    assert.ok(content.includes("var(--chrome)"), "sidebar.css should reference var(--chrome)");
  });

  it("--paper and --paper-edge are defined in both themes", () => {
    const content = readFileSync(INDEX_CSS, "utf8");
    // Split into :root (dark) and [data-theme="light"] blocks
    const darkMatch = content.match(/:root\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/);
    const lightMatch = content.match(/\[data-theme="light"\]\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/);
    assert.ok(darkMatch, ":root block not found");
    assert.ok(lightMatch, '[data-theme="light"] block not found');
    const dark = darkMatch![1];
    const light = lightMatch![1];
    assert.ok(/--paper:\s*#14161b/.test(dark), "--paper not #14161b in :root (dark)");
    assert.ok(/--paper-edge:\s*#1b1e25/.test(dark), "--paper-edge not #1b1e25 in :root (dark)");
    assert.ok(/--paper:\s*#ffffff/.test(light), "--paper not #ffffff in light theme");
    assert.ok(/--paper-edge:\s*#f8fafc/.test(light), "--paper-edge not #f8fafc in light theme");
  });

  it("hardcoded hex count does not regress above snapshot", () => {
    const SNAPSHOT = 67; // frozen at wp4 completion
    let total = 0;
    for (const file of cssFiles) {
      const content = readFileSync(file, "utf8");
      const lines = content.split("\n");
      for (const line of lines) {
        // Skip custom property definitions
        if (/^\s*--[a-z]/.test(line)) continue;
        const matches = line.match(/#[0-9a-fA-F]{3,8}\b/g);
        if (matches) total += matches.length;
      }
    }
    assert.ok(
      total <= SNAPSHOT,
      `Hardcoded hex count ${total} exceeds snapshot ${SNAPSHOT}`
    );
  });
});
