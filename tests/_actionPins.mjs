// Shared GitHub Actions pin assertions.
//
// Two prior incidents shaped this file. #162 and #178 both broke a Dependabot
// bump because a test froze one literal commit SHA, and the fix for #162 left a
// looser pattern behind: /[0-9a-f]{40}\b/ matches `@<sha>-evil`, `@<sha>/evil`,
// and `@<sha>.evil` too, because \b sits between the last hex digit and the
// punctuation. Those are all mutable refs a fork can move. So the rule here is
// "the whole ref token is exactly 40 lowercase hex characters", checked
// positively over every external `uses:` in the file rather than by blacklisting
// `@vN`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// `- uses: owner/repo@ref` or `uses: owner/repo@ref`, with an optional trailing
// comment. Anchored to the whole line at both ends so nothing trails the ref.
const USES_LINE = /^[\t ]*(?:-[\t ]+)?uses:[\t ]*(\S+)[\t ]*(?:#.*)?$/;
// Any line whose YAML key is `uses:`. Every one of these must parse, or the
// sweep below is silently skipping refs.
const USES_KEY_LINE = /^[\t ]*(?:-[\t ]+)?uses:/;
const PINNED_REF = /^[0-9a-f]{40}$/;
// Local composite actions (`./.github/actions/x`) and reusable local workflows
// carry no ref and are covered by this repo's own review, not by pinning.
const LOCAL_USE = /^\.{1,2}\//;

function unquote(value) {
  const first = value[0];
  if ((first === '"' || first === "'") && value.at(-1) === first) return value.slice(1, -1);
  return value;
}

/**
 * Parse every `uses:` entry in one workflow file.
 * Throws if a `uses:` key line does not parse, so a future YAML shape cannot
 * quietly drop out of the pin sweep.
 */
export function parseActionUses(text, label = "workflow") {
  const entries = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (!USES_KEY_LINE.test(line)) return;
    const match = USES_LINE.exec(line);
    assert.ok(match, `${label}:${index + 1} has a \`uses:\` key this gate cannot parse: ${line.trim()}`);
    const value = unquote(match[1]);
    const at = value.lastIndexOf("@");
    entries.push({
      label,
      line: index + 1,
      raw: line.trim(),
      action: at === -1 ? value : value.slice(0, at),
      ref: at === -1 ? null : value.slice(at + 1),
      local: LOCAL_USE.test(value),
    });
  });
  return entries;
}

/** True only when the whole ref token is an exact 40-char lowercase commit. */
export function isImmutablePin(ref) {
  return typeof ref === "string" && PINNED_REF.test(ref);
}

/**
 * Assert every external action in `text` is pinned to a 40-hex commit.
 * Rejects tags (`@v4`), branches (`@main`), short hex, and SHA-prefixed mutable
 * refs (`@<sha>-evil`).
 *
 * `requireUses` defaults to true so a call naming one workflow cannot pass on an
 * empty file. Pass false when sweeping the whole tree, where a run-only workflow
 * such as ci-timing-report.yml legitimately declares no actions; assert the
 * tree-wide ref total instead.
 */
export function assertAllActionsPinned(text, label = "workflow", { requireUses = true } = {}) {
  const entries = parseActionUses(text, label);
  if (requireUses) {
    assert.ok(entries.length > 0, `${label} declares no \`uses:\` steps; the pin sweep would pass vacuously`);
  }
  for (const entry of entries) {
    if (entry.local) continue;
    assert.ok(
      isImmutablePin(entry.ref),
      `${entry.label}:${entry.line} is not pinned to an immutable 40-hex commit: ${entry.raw}`,
    );
  }
  return entries;
}

/**
 * Assert a specific action is present and pinned, without freezing which commit.
 * The SHA identity is Dependabot's business; the pin property is ours.
 */
export function assertActionPinned(text, action, label = "workflow") {
  const matches = parseActionUses(text, label).filter((entry) => entry.action === action);
  assert.ok(matches.length > 0, `${label} does not use ${action}`);
  for (const entry of matches) {
    assert.ok(
      isImmutablePin(entry.ref),
      `${entry.label}:${entry.line} must pin ${action} to a 40-hex commit: ${entry.raw}`,
    );
  }
  return matches;
}

/** Every workflow file under .github/workflows, read from the repo root. */
export function readWorkflow(name, root = process.cwd()) {
  return readFileSync(join(root, ".github/workflows", name), "utf8");
}
