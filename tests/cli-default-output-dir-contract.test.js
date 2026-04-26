import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const gen = readFileSync("bin/commands/gen.js", "utf-8");
const edit = readFileSync("bin/commands/edit.js", "utf-8");

test("CLI generation defaults save into configured generatedDir, not cwd", () => {
  assert.match(gen, /import \{ config \} from "\.\.\/\.\.\/config\.js"/);
  assert.match(gen, /target = `\$\{config\.storage\.generatedDir\}\/\$\{defaultOutName\(i,\s*norm\.images\.length\)\}`/);
  assert.doesNotMatch(gen, /else \{\s*target = defaultOutName\(i,\s*norm\.images\.length\);\s*\}/);
});

test("CLI edit defaults save into configured generatedDir, not cwd", () => {
  assert.match(edit, /import \{ config \} from "\.\.\/\.\.\/config\.js"/);
  assert.match(edit, /const target = args\.out \|\| `\$\{config\.storage\.generatedDir\}\/\$\{defaultOutName\(0,\s*1\)\}`/);
  assert.doesNotMatch(edit, /const target = args\.out \|\| defaultOutName\(0,\s*1\)/);
});
