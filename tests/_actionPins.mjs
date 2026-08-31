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
//
// The refs are read from the parsed YAML document, not by scanning lines. A
// line scanner is defeated by valid YAML: `- { uses: attacker/action@main }` in
// flow style has no `uses:` at line start, and a `run: |` block scalar can
// contain text that looks exactly like a pinned step. Both were found by review
// against an earlier line-based version of this file, and actionlint accepted
// the crafted workflow, so this is reachable YAML rather than a hypothetical.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument, isAlias, isMap, isSeq, isScalar, visit } from "yaml";

const PINNED_REF = /^[0-9a-f]{40}$/;
// Local composite actions (`./.github/actions/x`) and reusable local workflows
// carry no ref and are covered by this repo's own review, not by pinning.
const LOCAL_USE = /^\.{1,2}\//;

/**
 * Every `uses:` in one workflow, read from the parsed document.
 *
 * Uses the YAML AST so flow-style steps and quoted keys are found, block
 * scalars are not mistaken for steps, and aliases resolve to their anchor.
 * Throws on a parse error or on a `uses:` whose value is not a plain string,
 * so nothing can drop out of the sweep silently.
 */
export function parseActionUses(text, label = "workflow") {
  const doc = parseDocument(text, { merge: true });
  assert.deepEqual(
    doc.errors.map((error) => error.message),
    [],
    `${label} is not parseable YAML, so the pin sweep cannot see its steps`,
  );
  const entries = [];
  const seen = new Set();
  // An alias node carries no value of its own; resolve it to the anchor so the
  // ref that Actions would actually run is what gets checked.
  const deref = (node) => (isAlias(node) ? node.resolve(doc) : node);
  const record = (node, where) => {
    node = deref(node);
    assert.ok(
      isScalar(node) && typeof node.value === "string",
      `${label} ${where} has a \`uses:\` whose value is not a plain string; this gate cannot verify it`,
    );
    // An alias points back at its anchor, so the same declaration can be
    // reached twice. Dedupe by source offset to keep this a count of
    // declarations rather than of references.
    const offset = node.range ? node.range[0] : null;
    if (offset !== null && seen.has(offset)) return;
    if (offset !== null) seen.add(offset);
    const value = node.value.trim();
    const at = value.lastIndexOf("@");
    entries.push({
      label,
      where,
      line: offset === null ? 0 : text.slice(0, offset).split(/\r?\n/).length,
      offset,
      raw: value,
      action: at === -1 ? value : value.slice(0, at),
      ref: at === -1 ? null : value.slice(at + 1),
      local: LOCAL_USE.test(value),
    });
  };

  // Walk the two structural positions Actions actually honours: a step's
  // `uses`, and a job-level `uses` for a reusable workflow. Reading the
  // structure rather than every `uses` key anywhere means a `uses` under
  // `with:` cannot masquerade as a step, and vice versa.
  const jobs = doc.get("jobs", true);
  if (isMap(jobs)) {
    for (const jobPair of jobs.items) {
      const jobName = isScalar(jobPair.key) ? String(jobPair.key.value) : "?";
      const job = jobPair.value;
      if (!isMap(job)) continue;
      const jobUses = job.get("uses", true);
      if (jobUses !== undefined && jobUses !== null) record(jobUses, `jobs.${jobName}.uses`);
      const steps = job.get("steps", true);
      if (!isSeq(steps)) continue;
      steps.items.forEach((stepNode, index) => {
        if (!isMap(stepNode)) return;
        const stepUses = stepNode.get("uses", true);
        if (stepUses !== undefined && stepUses !== null) {
          record(stepUses, `jobs.${jobName}.steps[${index}].uses`);
        }
      });
    }
  }

  // Nothing may carry the `uses` key outside those positions. Without this a
  // reviewer reading the structural walk above cannot tell whether a `uses`
  // somewhere unexpected is unreachable or merely unchecked - so fail instead
  // of guessing. Block scalars (`run: |`) are not Pair nodes and never reach
  // here, which is what stops crafted `run:` text from being counted as a step.
  visit(doc, {
    Pair(_key, pair) {
      if (!isScalar(pair.key) || pair.key.value !== "uses") return;
      const node = deref(pair.value);
      const offset = isScalar(node) && node.range ? node.range[0] : null;
      assert.ok(
        offset !== null && seen.has(offset),
        `${label} declares \`uses:\` outside a step or job position, where this gate cannot verify it: ${
          isScalar(node) ? String(node.value) : "(non-scalar)"
        }`,
      );
    },
  });
  entries.sort((a, b) => a.line - b.line);
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
