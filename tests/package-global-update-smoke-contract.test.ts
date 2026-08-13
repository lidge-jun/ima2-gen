import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ASYNC_LABELS,
  DEADLINES,
  SYNC_LABELS,
  commandOptions,
} from "../scripts/package-global-update-smoke.mjs";
import { deadlineError } from "../scripts/subprocess-deadline.mjs";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const smokeSource = readFileSync(join(repoRoot, "scripts", "package-global-update-smoke.mjs"), "utf8");

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
});
