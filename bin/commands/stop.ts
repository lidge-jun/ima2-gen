import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import {
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

  // Service-managed? KeepAlive will resurrect a plain kill.
  const stateFile = join(process.env.IMA2_CONFIG_DIR || join(homedir(), ".ima2"), "service-state.json");
  if (existsSync(stateFile)) {
    console.log("\n  Note: ima2 is installed as a background service — a plain stop will be");
    console.log("  restarted automatically. Use 'ima2 service stop' to stop it properly.");
    console.log("  Continuing anyway (this stop affects the current process only).\n");
  }

  const identity = await verifyServerIdentity(entry);
  if (identity === "mismatch") {
    cleanupAdvertise(path, pid);
    console.log(`\n  A different server answers where pid ${pid} was advertised.`);
    console.log("  Refusing to kill a process the advertise file cannot vouch for.");
    console.log("  Cleaned the stale advertise file; stop the other server from its own CLI.\n");
    return;
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
