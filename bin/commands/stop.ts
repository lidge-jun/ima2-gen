import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  corroborateByStartTime,
  escalateKill,
  gracefulStop,
  isProcessAlive,
  verifyServerIdentity,
  waitForExit,
  type AdvertiseEntry,
} from "../../lib/processControl.js";

function advertisePath(): string {
  return (
    process.env.IMA2_ADVERTISE_FILE ||
    join(process.env.IMA2_CONFIG_DIR || join(homedir(), ".ima2"), "server.json")
  );
}

function readAdvertise(path: string): AdvertiseEntry | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as AdvertiseEntry;
  } catch {
    return null;
  }
}

function cleanupAdvertise(path: string, pid: number | undefined): void {
  try {
    const cur = readAdvertise(path);
    if (cur && (pid === undefined || cur.pid === pid)) unlinkSync(path);
  } catch {
    /* best effort */
  }
}

/**
 * `ima2 stop [--force]` — stop the running ima2 server safely.
 *
 * Sequence: advertise file → pid identity verification (never kill a recycled
 * pid) → graceful admin-API stop → SIGTERM → SIGKILL escalation → stale-file
 * cleanup. Idempotent: "not running" exits 0.
 */
export async function stop(args: string[] = []): Promise<void> {
  const force = args.includes("--force");
  const path = advertisePath();
  const entry = readAdvertise(path);

  if (!entry || !entry.pid) {
    if (entry === null && existsSync(path)) {
      cleanupAdvertise(path, undefined);
      console.log("\n  Removed unreadable advertise file. No server to stop.\n");
      return;
    }
    console.log("\n  ima2 server is not running.\n");
    return;
  }

  const pid = Number(entry.pid);
  if (!isProcessAlive(pid)) {
    cleanupAdvertise(path, pid);
    console.log(`\n  ima2 server (pid ${pid}) is not running. Cleaned stale advertise file.\n`);
    return;
  }

  if (process.platform === "win32") {
    console.log("\n  'ima2 stop' is not supported on Windows yet (SIGTERM would orphan");
    console.log("  the provider proxies). Stop the server from its own terminal (Ctrl+C)");
    console.log(`  or: taskkill /PID ${pid} /T\n`);
    process.exitCode = 1;
    return;
  }

  // Service-managed? KeepAlive will resurrect a plain kill — refuse without --force
  // (ownership refusal, mirroring opencodex's 409 semantics in spirit).
  const stateFile = join(process.env.IMA2_CONFIG_DIR || join(homedir(), ".ima2"), "service-state.json");
  if (existsSync(stateFile)) {
    if (!force) {
      console.log("\n  ima2 is installed as a background service: KeepAlive would restart");
      console.log("  the server immediately after this stop, so it would be a lie.");
      console.log("  Use 'ima2 service stop' — or 'ima2 stop --force' to kill it anyway.\n");
      process.exitCode = 1;
      return;
    }
    console.log("\n  --force: stopping a service-managed server; KeepAlive may restart it.\n");
  }

  const identity = await verifyServerIdentity(entry);
  if (identity === "mismatch") {
    cleanupAdvertise(path, pid);
    console.log(`\n  A different server answers where pid ${pid} was advertised.`);
    console.log("  Refusing to kill a process the advertise file cannot vouch for.");
    console.log("  Cleaned the stale advertise file; stop the other server from its own CLI.\n");
    return;
  }

  if (identity === "unreachable") {
    // HTTP says nothing — corroborate with the process start time before ANY
    // signal. A recycled pid is provably younger than the advertised boot;
    // when we cannot tell, we refuse rather than guess (audit blocker 1).
    const corroboration = corroborateByStartTime(pid, Number(entry.startedAt) || undefined);
    if (corroboration !== "corroborated") {
      console.log(`\n  pid ${pid} is alive but the server is unreachable, and its start time`);
      console.log(
        corroboration === "recycled"
          ? "  shows it is NOT the advertised server (the pid was recycled)."
          : "  could not be corroborated against the advertise file.",
      );
      console.log("  Refusing to send signals to a process that may not be ours.");
      if (corroboration === "recycled") cleanupAdvertise(path, pid);
      else console.log(`  If you are sure, stop it manually: kill ${pid}`);
      console.log("");
      process.exitCode = corroboration === "recycled" ? 0 : 1;
      return;
    }
  }

  if (!force && identity === "match") {
    const ok = await gracefulStop(entry);
    if (ok && (await waitForExit(pid, 8000))) {
      cleanupAdvertise(path, pid);
      console.log(`\n  Stopped ima2 server (pid ${pid}) gracefully.\n`);
      return;
    }
  }

  const outcome = await escalateKill(pid);
  switch (outcome) {
    case "already-dead":
      console.log(`\n  ima2 server (pid ${pid}) had already exited.\n`);
      break;
    case "term":
      console.log(`\n  Stopped ima2 server (pid ${pid}) with SIGTERM.\n`);
      break;
    case "kill":
      console.log(`\n  Force-killed ima2 server (pid ${pid}) with SIGKILL.`);
      console.log("  Note: helper proxies may have been left behind; they exit on their own.\n");
      break;
    case "failed":
      console.error(`\n  Could not stop pid ${pid}. Try: kill -9 ${pid}\n`);
      process.exitCode = 1;
      return;
  }
  cleanupAdvertise(path, pid);
}
