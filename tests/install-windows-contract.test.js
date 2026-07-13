import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const installerPaths = [
  join(process.cwd(), "scripts", "install-windows.ps1"),
  join(process.cwd(), "site", "public", "install-windows.ps1"),
];

test("Windows installers use PowerShell 5.1-safe npm handling", () => {
  for (const installerPath of installerPaths) {
    const script = readFileSync(installerPath, "utf8");

    assert.match(
      script,
      /Join-Path \(Join-Path \$npmGlobal 'node_modules'\) '\.package-lock\.json'/,
      `${installerPath} should compose the npm lockfile path with nested Join-Path calls`,
    );
    assert.doesNotMatch(
      script,
      /Join-Path \$npmGlobal 'node_modules' '\.package-lock\.json'/,
      `${installerPath} should not pass three positional arguments to Join-Path`,
    );
    assert.match(script, /function Invoke-Npm/, `${installerPath} should isolate native npm invocation`);
    assert.match(
      script,
      /\$ErrorActionPreference = 'Continue'/,
      `${installerPath} should allow npm warnings to be captured without aborting the installer`,
    );
    assert.match(script, /\$installResult\.ExitCode -ne 0/, `${installerPath} should check npm's exit code`);
  }
});

test("published and source Windows installers stay in sync", () => {
  const [source, published] = installerPaths.map((path) => readFileSync(path, "utf8"));
  assert.equal(published, source);
});
