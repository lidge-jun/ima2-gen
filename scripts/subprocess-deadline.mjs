#!/usr/bin/env node
// Async subprocess runner that owns its own timer and process-tree cleanup.
//
// Why this exists (devlog/_plan/260813_maturity_roadmap/020): spawnSync's
// `timeout` kills only the direct child and, on Windows, returns only after
// that child dies — by then the PID is gone and `taskkill /T` has no root to
// enumerate. Grandchildren (npm lifecycle scripts, nested Codex probes) can
// survive and wedge the next step. This runner keeps the root alive until the
// deadline fires, then cleans the whole tree:
//   - Windows: taskkill /pid <pid> /T /F
//   - POSIX:   detached process group + process.kill(-pid, "SIGKILL")

import { spawn, spawnSync } from "node:child_process";

export function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err && err.code === "EPERM";
  }
}

function killTree(pid) {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "pipe" });
    return;
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // already gone
    }
  }
}

// Runs `command args` with an owned deadline. Resolves with
// { status, stdout, stderr, durationMs, timedOut: false } on completion.
// On deadline expiry the whole process tree is killed and the returned object
// carries `timedOut: true` plus cleanup diagnostics — callers decide whether
// to throw (see assertRunOk in the smoke) so the label reaches the error.
export function runWithDeadline(command, args, options = {}) {
  const {
    deadlineMs,
    label = `${command} ${args.join(" ")}`,
    cwd,
    env,
    shell = false,
    log = console.log,
  } = options;
  if (!Number.isFinite(deadlineMs) || deadlineMs <= 0) {
    throw new Error(`runWithDeadline requires a positive deadlineMs (label: ${label})`);
  }

  log(`[smoke] ${label} start`);
  const started = Date.now();

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const durationMs = Date.now() - started;
      log(`[smoke] ${label} done ${durationMs}ms`);
      resolvePromise(result);
    };

    const timer = setTimeout(() => {
      const rootAliveAtTimeout = pidAlive(child.pid);
      killTree(child.pid);
      const rootAliveAfterKill = pidAlive(child.pid);
      finish({
        status: null,
        stdout,
        stderr,
        durationMs: Date.now() - started,
        timedOut: true,
        cleanup: { rootAliveAtTimeout, rootAliveAfterKill },
      });
    }, deadlineMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        rejectPromise(err);
      }
    });
    child.on("close", (code) => {
      finish({ status: code, stdout, stderr, durationMs: Date.now() - started, timedOut: false });
    });
  });
}

export function deadlineError(result, label) {
  const cleanup = result.cleanup
    ? `\ncleanup: rootAliveAtTimeout=${result.cleanup.rootAliveAtTimeout} rootAliveAfterKill=${result.cleanup.rootAliveAfterKill}`
    : "";
  return new Error(
    `[deadline] ${label} exceeded its deadline${cleanup}\nstdout:\n${result.stdout || ""}\nstderr:\n${result.stderr || ""}`,
  );
}
