/**
 * Process-control helpers for `ima2 stop` (and service stop paths).
 *
 * Doctrine (adversarial audit 260821c): never kill a pid the advertise file
 * merely CLAIMS — verify identity against the live /api/health response first,
 * because pids get recycled. Graceful (admin API) before signals, SIGTERM
 * before SIGKILL, and a stale advertise file is cleaned, not trusted.
 */

export interface AdvertiseEntry {
  pid?: number;
  port?: number;
  url?: string;
  adminNonce?: string;
  [key: string]: unknown;
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Poll until the pid exits or the timeout lapses. CLI context: async is fine. */
export async function waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return !isProcessAlive(pid);
}

export type IdentityVerdict = "match" | "mismatch" | "unreachable";

/**
 * Does the server answering on entry.url/port actually carry entry.pid?
 * "mismatch" means someone else answers there (or the pid was recycled):
 * killing entry.pid would hit an innocent process.
 */
export async function verifyServerIdentity(
  entry: AdvertiseEntry,
  fetchFn: typeof fetch = fetch,
): Promise<IdentityVerdict> {
  const base = (entry.url ?? (entry.port ? `http://127.0.0.1:${entry.port}` : null))?.toString().replace(/\/$/, "");
  if (!base || !entry.pid) return "unreachable";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const r = await fetchFn(`${base}/api/health`, {
      signal: controller.signal,
      headers: { connection: "close" },
    });
    clearTimeout(timer);
    if (!r.ok) return "unreachable";
    const health = (await r.json()) as { pid?: number };
    return health.pid === entry.pid ? "match" : "mismatch";
  } catch {
    return "unreachable";
  }
}

/**
 * Ask the server to stop itself via the admin API. Requires the nonce from the
 * advertise file. Note: bin/lib/client.ts carries no LAN token, so on a
 * token-guarded non-loopback bind this degrades (401) to the signal path —
 * that is intended behavior, not an accident.
 */
export async function gracefulStop(
  entry: AdvertiseEntry,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  const base = (entry.url ?? (entry.port ? `http://127.0.0.1:${entry.port}` : null))?.toString().replace(/\/$/, "");
  if (!base || !entry.adminNonce) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const r = await fetchFn(`${base}/api/admin/stop`, {
      method: "POST",
      signal: controller.signal,
      headers: { "x-ima2-admin-nonce": entry.adminNonce, connection: "close" },
    });
    clearTimeout(timer);
    return r.status === 202;
  } catch {
    return false;
  }
}

export type KillOutcome = "graceful" | "term" | "kill" | "already-dead" | "failed";

/** SIGTERM → wait → SIGKILL → wait. Only ever called on an identity-verified pid. */
export async function escalateKill(
  pid: number,
  waits: { termMs?: number; killMs?: number } = {},
): Promise<KillOutcome> {
  if (!isProcessAlive(pid)) return "already-dead";
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return isProcessAlive(pid) ? "failed" : "already-dead";
  }
  if (await waitForExit(pid, waits.termMs ?? 5000)) return "term";
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    return isProcessAlive(pid) ? "failed" : "term";
  }
  if (await waitForExit(pid, waits.killMs ?? 2000)) return "kill";
  return "failed";
}
