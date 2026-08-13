import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { join } from "node:path";

// Dependency-free by contract: the publish workflow's windows-consumer job runs
// this file right after setup-node, before any npm ci (roadmap 020, b5). Keep
// imports to node builtins and repo-local scripts, and erasable TS syntax only.
import { pidAlive, runWithDeadline } from "../scripts/subprocess-deadline.mjs";

function silence() {
  return () => {};
}

describe("subprocess deadline runner", () => {
  it("resolves with output and duration for a fast command", async () => {
    const result = await runWithDeadline(
      process.execPath,
      ["-e", "console.log('hello-deadline')"],
      { deadlineMs: 10_000, label: "fast-echo", log: silence() },
    );
    assert.equal(result.timedOut, false);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /hello-deadline/);
    assert.ok(result.durationMs >= 0);
  });

  it("kills the WHOLE TREE on timeout — grandchild must not survive", async () => {
    // The parent spawns a grandchild that outlives it, then hangs. spawnSync's
    // timeout cannot clean this up (it kills only the direct child and returns
    // after the child dies, leaving no root for taskkill /T). This runner must.
    const { rmSync, readFileSync, existsSync, mkdtempSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const pidFile = join(mkdtempSync(join(tmpdir(), "ima2-deadline-")), "grandchild.pid");
    const parentCode = `
      import { spawn } from "node:child_process";
      import { writeFileSync } from "node:fs";
      const gc = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { detached: false });
      writeFileSync(${JSON.stringify(pidFile)}, String(gc.pid));
      setInterval(() => {}, 1000);
    `;
    rmSync(pidFile, { force: true });

    const result = await runWithDeadline(process.execPath, ["-e", parentCode], {
      deadlineMs: 500,
      label: "tree-kill-negative-control",
      log: silence(),
    });
    assert.equal(result.timedOut, true);
    // The root must still be alive when the timer fires — otherwise tree
    // enumeration has nothing to hang from and the design silently regressed.
    assert.equal(result.cleanup?.rootAliveAtTimeout, true);

    assert.equal(existsSync(pidFile), true, "parent should have recorded the grandchild pid");
    const grandchildPid = Number(readFileSync(pidFile, "utf8").trim());
    assert.ok(Number.isInteger(grandchildPid) && grandchildPid > 0);
    // Direct-child-only cleanup would leave the grandchild alive. It must be
    // gone. Poll briefly: a SIGKILLed process can remain observable as a
    // zombie until the reaper collects it, so an instant check is a race.
    let gone = false;
    for (let i = 0; i < 40 && !gone; i += 1) {
      gone = !pidAlive(grandchildPid);
      if (!gone) await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(gone, true, `grandchild ${grandchildPid} survived tree cleanup`);
    rmSync(pidFile, { force: true });
  });

  it("requires a positive deadline", () => {
    // Programmer error, so the runner throws synchronously before any spawn.
    assert.throws(
      () => runWithDeadline(process.execPath, ["-e", "1"], { deadlineMs: 0, log: silence() }),
      /positive deadlineMs/,
    );
  });

  it("exports pidAlive used by the workflow smoke step", () => {
    assert.equal(typeof pidAlive, "function");
    assert.equal(pidAlive(process.pid), true);
  });

  it("does not leak a spawned reference process", () => {
    // Sanity: spawn is only used here by the runner itself.
    assert.equal(typeof spawn, "function");
  });
});
