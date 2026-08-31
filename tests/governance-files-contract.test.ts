import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { assertActionPinned, assertAllActionsPinned } from "./_actionPins.mjs";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { scripts: Record<string, string> };

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("governance files", () => {
  it("keeps the six governance files and the two supply-chain configs", () => {
    for (const path of [
      "SECURITY.md",
      "CONTRIBUTING.md",
      ".github/CODEOWNERS",
      ".github/ISSUE_TEMPLATE/bug.yml",
      ".github/ISSUE_TEMPLATE/feature.yml",
      ".github/ISSUE_TEMPLATE/config.yml",
      ".github/pull_request_template.md",
      ".github/workflows/codeql.yml",
      ".github/dependabot.yml",
    ]) {
      assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), true, path);
    }
  });

  it("pins CODEOWNERS to the current maintainer and both lockfiles", () => {
    const owners = read(".github/CODEOWNERS");
    assert.match(owners, /^\* @lidge-jun$/m);
    assert.match(owners, /^\/package-lock\.json @lidge-jun$/m);
    assert.match(owners, /^\/ui\/package-lock\.json @lidge-jun$/m);
  });

  it("keeps CONTRIBUTING staged and does not require the full release gate", () => {
    const doc = read("CONTRIBUTING.md");
    assert.match(doc, /`npm run typecheck`/);
    assert.match(doc, /`npm test`/);
    assert.match(doc, /cd ui && npm run build/);
    assert.match(doc, /verify:release:source` is optional/);
    assert.doesNotMatch(doc, /must run `npm run verify:release:source`/);
    assert.equal(typeof pkg.scripts.typecheck, "string");
    assert.equal(typeof pkg.scripts.test, "string");
    assert.equal(typeof pkg.scripts["ui:build"], "string");
  });

  it("points SECURITY.md at advisories without promising an SLA", () => {
    const doc = read("SECURITY.md");
    assert.match(doc, /security\/advisories\/new/);
    assert.doesNotMatch(doc, /48 hours|within 48/);
    assert.match(doc, /no promised SLA|There is no promised SLA/);
  });

  it("pins CodeQL and nix actions to immutable SHAs", () => {
    const codeql = read(".github/workflows/codeql.yml");
    // The rule is "pinned to an immutable commit", not "pinned to one specific
    // commit forever". Hardcoding the SHA here made every Dependabot bump fail
    // this gate even when the bump was correctly pinned (#162, then #178 again).
    // assertActionPinned checks the property and leaves the commit identity to
    // Dependabot; assertAllActionsPinned covers the rest of the file positively,
    // which also rejects branch pins like @main that a @vN blacklist let through.
    assertActionPinned(codeql, "github/codeql-action/init", ".github/workflows/codeql.yml");
    assertActionPinned(codeql, "github/codeql-action/analyze", ".github/workflows/codeql.yml");
    assert.match(codeql, /languages: javascript-typescript/);
    assert.match(codeql, /build-mode: none/);
    assertAllActionsPinned(codeql, ".github/workflows/codeql.yml");
    const nix = read(".github/workflows/nix.yml");
    assertActionPinned(nix, "cachix/install-nix-action", ".github/workflows/nix.yml");
    assertAllActionsPinned(nix, ".github/workflows/nix.yml");
  });

  it("groups Dependabot updates and caps open PRs at 5", () => {
    const yaml = read(".github/dependabot.yml");
    assert.match(yaml, /package-ecosystem: npm[\s\S]*directory: \/[\s\S]*open-pull-requests-limit: 5/);
    assert.match(yaml, /directory: \/ui/);
    assert.match(yaml, /package-ecosystem: github-actions/);
    assert.match(yaml, /production-npm:/);
    assert.match(yaml, /development-npm:/);
    assert.match(yaml, /github-actions:/);
  });

  it("asks bug reports for doctor --bundle and forbids secrets", () => {
    const bug = read(".github/ISSUE_TEMPLATE/bug.yml");
    assert.match(bug, /ima2 doctor --bundle/);
    assert.match(bug, /ima2 doctor image-probe --json/);
    assert.match(bug, /Do not attach cookies/);
  });
});
