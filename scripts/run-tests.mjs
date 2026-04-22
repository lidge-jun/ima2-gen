#!/usr/bin/env node
// Cross-platform test runner. Avoids shell glob expansion differences
// between bash (linux/macos), pwsh (windows), and cmd.
import { readdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";

const testDir = "tests";
const files = readdirSync(testDir)
  .filter((f) => f.endsWith(".test.js"))
  .map((f) => join(testDir, f))
  .sort();

if (files.length === 0) {
  console.error(`No test files found in ${testDir}/`);
  process.exit(1);
}

const child = spawn(process.execPath, ["--test", ...files], {
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 1));
