#!/usr/bin/env node
// Asserts that the npm package manifest contains every generated runtime .js
// whose tracking was removed (devlog/_plan/260813_maturity_roadmap/010).
// Untracking must never turn into a missing package file: these files are the
// actual runtime shipped to users.
//
// Usage:
//   node scripts/check-pack-manifest.mjs                 # packs into a temp dir
//   IMA2_PACKAGE_TARBALL=<path> node scripts/check-pack-manifest.mjs  # reuse
//
// Exit 0 = all expected paths present. Exit 1 = missing paths (listed).

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const listPath = join(repoRoot, "scripts", "paired-generated-paths.txt");
const expected = readFileSync(listPath, "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

function packIntoTemp() {
  const packDir = mkdtempSync(join(tmpdir(), "ima2-pack-manifest-"));
  try {
    const out = execFileSync(
      "npm",
      ["pack", "--ignore-scripts", "--json", "--pack-destination", packDir],
      { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    const parsed = JSON.parse(out);
    return { files: parsed[0].files.map((f) => f.path), packDir };
  } catch (err) {
    rmSync(packDir, { recursive: true, force: true });
    throw err;
  }
}

function listTarball(tarball) {
  if (!existsSync(tarball)) {
    console.error(`IMA2_PACKAGE_TARBALL does not exist: ${tarball}`);
    process.exit(1);
  }
  const out = execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" });
  return out
    .split("\n")
    .map((line) => line.replace(/^package\//, ""))
    .filter(Boolean);
}

let files;
let packDir = null;
if (process.env.IMA2_PACKAGE_TARBALL) {
  files = listTarball(process.env.IMA2_PACKAGE_TARBALL);
} else {
  const packed = packIntoTemp();
  files = packed.files;
  packDir = packed.packDir;
}

try {
  const present = new Set(files);
  const missing = expected.filter((path) => !present.has(path));
  if (missing.length > 0) {
    console.error(`pack manifest is missing ${missing.length} expected runtime file(s):`);
    for (const path of missing) console.error(`  ${path}`);
    process.exit(1);
  }
  console.log(`pack manifest OK: all ${expected.length} generated runtime files present`);
} finally {
  if (packDir) rmSync(packDir, { recursive: true, force: true });
}
