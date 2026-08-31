import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ASYNC_LABELS,
  DEADLINES,
  PREPACKED_CI_SEQUENCE,
  SYNC_LABELS,
  beginDeadlineTrace,
  commandOptions,
  finishDeadlineTrace,
  minimumPrepackedWorkflowTimeoutMinutes,
} from "../scripts/package-global-update-smoke.mjs";
import { deadlineError } from "../scripts/subprocess-deadline.mjs";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const smokeSource = readFileSync(join(repoRoot, "scripts", "package-global-update-smoke.mjs"), "utf8");
const publishWorkflow = readFileSync(join(repoRoot, ".github", "workflows", "publish.yml"), "utf8");
const releaseWorkflow = readFileSync(join(repoRoot, ".github", "workflows", "release.yml"), "utf8");

function yamlJob(source: string, name: string) {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line === `  ${name}:`);
  assert.ok(start >= 0, `missing workflow job: ${name}`);
  const relativeEnd = lines.slice(start + 1).findIndex((line) => /^  [A-Za-z0-9_-]+:\s*$/.test(line));
  const end = relativeEnd < 0 ? lines.length : start + 1 + relativeEnd;
  return lines.slice(start, end).join("\n");
}

function yamlStep(job: string, anchor: string) {
  const lines = job.split("\n");
  const starts = lines.flatMap((line, index) => /^      - /.test(line) ? [index] : []);
  const start = starts.find((index) => lines.slice(index, starts.find((next) => next > index) ?? lines.length).join("\n").includes(anchor));
  assert.notEqual(start, undefined, `missing workflow step: ${anchor}`);
  const end = starts.find((index) => index > start!) ?? lines.length;
  return lines.slice(start, end).join("\n");
}

function timeoutFrom(block: string, anchor: string) {
  const match = block.match(/^\s*timeout-minutes:\s*(\d+)\s*$/m);
  assert.ok(match, `missing timeout for: ${anchor}`);
  return Number(match[1]);
}

function runCommand(step: string) {
  const lines = step.split("\n");
  const runIndex = lines.findIndex((line) => /^\s+run:/.test(line));
  assert.ok(runIndex >= 0, "workflow step has no run command");
  const inline = lines[runIndex].replace(/^\s+run:\s*(?:[>|]-?\s*)?/, "");
  const body = [inline, ...lines.slice(runIndex + 1).map((line) => line.trim())].filter(Boolean);
  return body.join(" ").replace(/\s+/g, " ").trim();
}

function explicitWaitTimeout(step: string, script: string) {
  const command = runCommand(step);
  assert.ok(command.startsWith(`node scripts/${script} wait `), `unexpected wait command: ${command}`);
  const match = command.match(/\s(\d+)$/);
  assert.ok(match, `${script} wait must end with an explicit timeout`);
  return Number(match[1]);
}

describe("package-global-update smoke deadline contract", () => {
  it("every sync step gets a spawnSync timeout from commandOptions()", () => {
    // b1 sync oracle: the caller, not the helper, is what must pass the value.
    for (const label of SYNC_LABELS) {
      const options = commandOptions({ label });
      assert.equal(typeof options.timeout, "number", `${label} must carry a timeout`);
      assert.ok(options.timeout > 0, `${label} timeout must be positive`);
      assert.equal(options.timeout, DEADLINES[label]);
    }
  });

  it("every tree-owning step has a runner deadline and runs through the async runner", () => {
    // b1 async oracle: async steps must NOT rely on spawnSync timeout; they own
    // their timer so the process tree can be cleaned (Windows grandchild case).
    assert.deepEqual([...ASYNC_LABELS].sort(), ["baseline-install", "codex-login-status", "ima2-doctor", "ima2-status", "pack", "tarball-install"].sort());
    for (const label of ASYNC_LABELS) {
      assert.ok(DEADLINES[label] > 0, `${label} must have a deadline`);
      assert.ok(
        smokeSource.includes(`"${label}"`),
        `smoke source must reference the ${label} step by its literal label`,
      );
    }
  });

  it("IMA2_SMOKE_TIMEOUT_MS overrides every deadline (activation path)", () => {
    const previous = process.env.IMA2_SMOKE_TIMEOUT_MS;
    process.env.IMA2_SMOKE_TIMEOUT_MS = "1";
    try {
      const options = commandOptions({ label: "npm-version" });
      assert.equal(options.timeout, 1);
    } finally {
      if (previous === undefined) delete process.env.IMA2_SMOKE_TIMEOUT_MS;
      else process.env.IMA2_SMOKE_TIMEOUT_MS = previous;
    }
  });

  it("timeout errors name the step label, not just ETIMEDOUT", () => {
    // b3: an undifferentiated ETIMEDOUT is exactly the failure mode of run
    // 31605449399 — the label must reach the error message.
    const err = deadlineError(
      { timedOut: true, stdout: "", stderr: "", cleanup: { rootAliveAtTimeout: true, rootAliveAfterKill: false } },
      "baseline-install",
    );
    assert.match(err.message, /baseline-install/);
    assert.match(err.message, /rootAliveAtTimeout=true/);
  });

  it("keeps the sync/async split pinned to the documented inventory", () => {
    // 14 local children = 7 sync + 7 async (async pack is local-only, so CI has
    // 13). The counts are the contract; drifting them silently is how the
    // orphan defect came back.
    assert.equal(SYNC_LABELS.length, 3, "sync labels: npm-version, npm-root, shim-version");
    assert.equal(ASYNC_LABELS.length, 6, "async labels (pack is the local-only 7th call)");
  });

  it("keeps the Windows prepacked smoke inside its outer workflow timeout", () => {
    assert.equal(PREPACKED_CI_SEQUENCE.filter((label) => label === "tarball-install").length, 2);
    assert.equal(PREPACKED_CI_SEQUENCE.filter((label) => label === "baseline-install").length, 1);
    const windowsStep = yamlStep(
      yamlJob(publishWorkflow, "windows-consumer"),
      "Update a real global install and probe package-local OAuth",
    );
    const windowsTimeout = timeoutFrom(windowsStep, "Windows package update smoke");
    assert.ok(
      windowsTimeout >= minimumPrepackedWorkflowTimeoutMinutes(),
      `Windows outer timeout ${windowsTimeout}m must envelope ${minimumPrepackedWorkflowTimeoutMinutes()}m of child deadlines`,
    );
  });

  it("uses the budget sequence as a runtime trace, not a test-only estimate", () => {
    beginDeadlineTrace(["npm-version", "npm-root"]);
    commandOptions({ label: "npm-version" });
    commandOptions({ label: "npm-root" });
    finishDeadlineTrace();

    beginDeadlineTrace(["npm-version", "npm-root"]);
    commandOptions({ label: "npm-version" });
    assert.throws(() => finishDeadlineTrace(), /stopped before npm-root/);
  });

  it("keeps preview publication and the cut job outside their nested waits", () => {
    const packageJob = yamlJob(publishWorkflow, "package");
    const windowsJob = yamlJob(publishWorkflow, "windows-consumer");
    const cutJob = yamlJob(releaseWorkflow, "cut");
    const packageTimeout = timeoutFrom(
      yamlStep(packageJob, "npm run verify:release:source"),
      "package source verification",
    );
    const windowsTimeout = timeoutFrom(
      yamlStep(windowsJob, "Update a real global install and probe package-local OAuth"),
      "Update a real global install and probe package-local OAuth",
    );
    const candidateVerifyTimeout = timeoutFrom(
      yamlStep(cutJob, "Verify the release candidate before promoting it"),
      "Verify the release candidate before promoting it",
    );
    const candidateCiTimeout = explicitWaitTimeout(
      yamlStep(cutJob, "Wait for the candidate CI gate"),
      "wait-ci-gate.mjs",
    );
    const previewWaitTimeout = explicitWaitTimeout(
      yamlStep(cutJob, "Wait for the preview publish to finish"),
      "wait-publish-run.mjs",
    );
    const cutTimeout = timeoutFrom(cutJob, "release cut job");

    assert.ok(previewWaitTimeout >= packageTimeout + windowsTimeout + 15);
    assert.ok(cutTimeout >= candidateVerifyTimeout + candidateCiTimeout + previewWaitTimeout + 20);
  });
});
