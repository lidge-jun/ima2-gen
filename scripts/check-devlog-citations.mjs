#!/usr/bin/env node
// Enforces the devlog citation convention: every `file:line` reference must carry a
// repo-root-relative path. Abbreviated citations (bare line numbers, or a filename
// with no directory) are unverifiable and ambiguous across the server `lib/` and the
// client `ui/src/lib/` trees.
//
// Usage: node scripts/check-devlog-citations.mjs [dir ...]
// Default target: devlog/_plan/260726_zero-backlog-frontend-qa

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_DIRS = ["devlog/_fin/260726_zero-backlog-frontend-qa"];

// A citation that starts with a colon, e.g. a bare line reference inside backticks.
const BARE_LINE = /`:\d/;
// A citation with an extension and line number but no directory separator before it.
const BARE_FILENAME = /`[A-Za-z][A-Za-z0-9_.-]*\.(?:ts|tsx|css|json|mjs|js):\d/;

function markdownFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return markdownFiles(full);
    return full.endsWith(".md") ? [full] : [];
  });
}

const targets = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_DIRS;
const violations = [];

for (const dir of targets) {
  for (const file of markdownFiles(dir)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (BARE_LINE.test(line)) {
        violations.push({ file, line: index + 1, kind: "bare-line", text: line.trim() });
      } else if (BARE_FILENAME.test(line)) {
        violations.push({ file, line: index + 1, kind: "bare-filename", text: line.trim() });
      }
    });
  }
}

if (violations.length > 0) {
  for (const v of violations) {
    console.error(`${v.file}:${v.line} [${v.kind}] ${v.text.slice(0, 110)}`);
  }
  console.error(`\n${violations.length} abbreviated citation(s). Use repo-root-relative paths.`);
  process.exit(1);
}

console.log(`devlog citations OK (${targets.join(", ")})`);
