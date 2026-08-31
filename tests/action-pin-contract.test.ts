import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertActionPinned,
  assertAllActionsPinned,
  isImmutablePin,
  parseActionUses,
} from "./_actionPins.mjs";

const SHA = "a".repeat(40);
const WORKFLOW_DIR = ".github/workflows";

function workflowFiles(): string[] {
  return readdirSync(WORKFLOW_DIR)
    .filter((name) => /\.ya?ml$/.test(name))
    .sort();
}

function step(ref: string): string {
  return ["jobs:", "  a:", "    steps:", `      - uses: actions/checkout@${ref}`].join("\n");
}

// This file is the regression guard for the pin gate itself. #162 and #178 were
// both the same bug: a test froze a literal commit SHA, so a correctly pinned
// Dependabot bump failed. The fix for #162 replaced one literal with
// /[0-9a-f]{40}\b/, which is not a pin check at all. Everything below exists so
// a future loosening fails here instead of shipping.
describe("action pin gate", () => {
  it("accepts any exact 40-hex lowercase commit", () => {
    assert.equal(isImmutablePin(SHA), true);
    assert.equal(isImmutablePin("ff2f1c621b7f889edc0d3c761ac2e6a3f8cdb0dd"), true);
    assert.doesNotThrow(() => assertAllActionsPinned(step(SHA), "fixture"));
  });

  it("rejects tag, branch, and short refs", () => {
    for (const ref of ["v4", "v4.37.8", "main", "dev", "latest", SHA.slice(0, 39), SHA.slice(0, 7)]) {
      assert.equal(isImmutablePin(ref), false, `${ref} must not count as a pin`);
      assert.throws(
        () => assertAllActionsPinned(step(ref), "fixture"),
        /not pinned to an immutable 40-hex commit/,
        `@${ref} must fail the gate`,
      );
    }
  });

  // The exact hole the round-1 audit found in the #162 pattern: a trailing \b
  // matches between the 40th hex digit and punctuation, so every ref below
  // passed while pointing at something a fork can move.
  it("rejects mutable refs that merely start with 40 hex characters", () => {
    for (const ref of [`${SHA}-evil`, `${SHA}/evil`, `${SHA}.evil`, `${SHA}_evil`, `${SHA}${SHA}`]) {
      assert.equal(isImmutablePin(ref), false, `${ref} must not count as a pin`);
      assert.throws(() => assertAllActionsPinned(step(ref), "fixture"), /not pinned to an immutable/);
    }
  });

  it("rejects uppercase hex so the ref is byte-comparable to git output", () => {
    assert.equal(isImmutablePin(SHA.toUpperCase()), false);
    assert.equal(isImmutablePin("A".repeat(40)), false);
  });

  it("does not let a trailing comment or quotes smuggle a second token", () => {
    const commented = `jobs:\n  a:\n    steps:\n      - uses: actions/checkout@${SHA} # v7.0.1`;
    assert.doesNotThrow(() => assertAllActionsPinned(commented, "fixture"));
    const quoted = `jobs:\n  a:\n    steps:\n      - uses: "actions/checkout@${SHA}"`;
    assert.doesNotThrow(() => assertAllActionsPinned(quoted, "fixture"));
    const smuggled = `jobs:\n  a:\n    steps:\n      - uses: actions/checkout@${SHA} extra`;
    assert.throws(() => assertAllActionsPinned(smuggled, "fixture"), /cannot parse/);
  });

  it("fails loudly rather than passing vacuously", () => {
    assert.throws(() => assertAllActionsPinned("jobs:\n  a:\n    steps: []\n", "fixture"), /no .*uses.* steps/);
    assert.throws(() => assertActionPinned(step(SHA), "github/codeql-action/init", "fixture"), /does not use/);
  });

  it("skips local composite actions, which carry no ref", () => {
    const local = `jobs:\n  a:\n    steps:\n      - uses: ./.github/actions/setup\n      - uses: actions/checkout@${SHA}`;
    const entries = assertAllActionsPinned(local, "fixture");
    assert.equal(entries.filter((entry) => entry.local).length, 1);
  });

  // The tree-wide sweep. Scoping the gate to a hand-listed set of workflows is
  // how codeql.yml ended up as the only pinned file in the first place.
  it("pins every external action in every workflow", () => {
    const files = workflowFiles();
    assert.ok(files.length >= 11, `expected the full workflow set, found ${files.length}`);
    let external = 0;
    for (const name of files) {
      const text = readFileSync(join(WORKFLOW_DIR, name), "utf8");
      // requireUses is off here on purpose: ci-timing-report.yml is a run-only
      // observer with no actions. The tree-wide total below is what stops this
      // sweep from passing on an empty parse.
      const entries = assertAllActionsPinned(text, `${WORKFLOW_DIR}/${name}`, { requireUses: false });
      external += entries.filter((entry) => !entry.local).length;
    }
    assert.ok(external >= 40, `expected the full pin surface, swept ${external} refs`);
  });

  it("leaves no literal action SHA frozen in any test file", () => {
    const offenders: string[] = [];
    for (const name of readdirSync("tests").sort()) {
      if (!/\.test\.[cm]?[jt]s$/.test(name)) continue;
      if (name === "action-pin-contract.test.ts") continue;
      const text = readFileSync(join("tests", name), "utf8");
      text.split(/\r?\n/).forEach((line, index) => {
        if (/[\w./-]+@[0-9a-f]{40}/.test(line)) offenders.push(`tests/${name}:${index + 1}`);
      });
    }
    assert.deepEqual(
      offenders,
      [],
      `these lines freeze one commit, so the next Dependabot bump fails: ${offenders.join(", ")}`,
    );
  });

  it("parses the same ref count the raw grep sees", () => {
    for (const name of workflowFiles()) {
      const text = readFileSync(join(WORKFLOW_DIR, name), "utf8");
      const rawCount = text.split(/\r?\n/).filter((line) => /^[\t ]*(?:-[\t ]+)?uses:/.test(line)).length;
      assert.equal(parseActionUses(text, name).length, rawCount, `${name} lost a uses: entry during parsing`);
    }
  });
});
