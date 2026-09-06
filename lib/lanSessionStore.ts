import { createHash, randomBytes as cryptoRandomBytes } from "node:crypto";
import { localAccessError } from "./localAccessPolicy.js";

interface SessionRecord {
  origin: string;
  issuedAt: number;
  expiresAt: number;
  closers: Set<() => void>;
}
const ID_ATTEMPTS = 4;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

interface SessionOptions {
  ttlMs: number; maxSessions: number; now?: () => number;
  randomBytes?: (size: number) => Buffer;
}

class LanSessionStore {
  private readonly now: () => number;
  private readonly random: (size: number) => Buffer;
  private readonly records = new Map<string, SessionRecord>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;

  constructor(private readonly options: SessionOptions) {
    this.now = options.now ?? Date.now; this.random = options.randomBytes ?? cryptoRandomBytes;
  }
  private remove(key: string) {
    const record = this.records.get(key);
    this.records.delete(key);
    if (!record) return;
    const closers = [...record.closers];
    record.closers.clear();
    for (const close of closers) {
      try { close(); } catch { /* A broken response must not prevent revoking its siblings. */ }
    }
  }
  private schedule() {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.disposed || !this.records.size) return;
    const nearest = Math.min(...[...this.records.values()].map(record => record.expiresAt));
    this.timer = setTimeout(() => { this.prune(); this.schedule(); }, Math.max(1, nearest - this.now()));
    this.timer.unref();
  }
  private prune() {
    for (const [key, record] of this.records) if (record.expiresAt <= this.now()) this.remove(key);
  }
  issue(origin: string) {
    if (this.disposed) throw localAccessError("LAN_SESSION_UNAVAILABLE", 503);
    this.prune();
    if (this.disposed) throw localAccessError("LAN_SESSION_UNAVAILABLE", 503);
    const { records, options, random, now } = this;
    if (records.size >= options.maxSessions) throw localAccessError("LAN_SESSION_CAPACITY", 503);
    for (let attempt = 0; attempt < ID_ATTEMPTS; attempt++) {
      let value: string;
      try { value = random(32).toString("base64url"); }
      catch { throw localAccessError("LAN_SESSION_UNAVAILABLE", 503); }
      const key = digest(value);
      if (records.has(key)) continue;
      const issuedAt = now(), expiresAt = issuedAt + options.ttlMs;
      records.set(key, { origin, issuedAt, expiresAt, closers: new Set() });
      this.schedule();
      return { value, expiresAt };
    }
    throw localAccessError("LAN_SESSION_UNAVAILABLE", 503);
  }
  validate(value: string, origin: string): { expiresAt: number } | null {
    this.prune(); this.schedule();
    const record = this.records.get(digest(value));
    return record?.origin === origin ? { expiresAt: record.expiresAt } : null;
  }
  track(value: string, close: () => void): () => void {
    this.prune(); this.schedule();
    const record = this.records.get(digest(value));
    if (!record) { close(); return () => {}; }
    record.closers.add(close);
    return () => { record.closers.delete(close); };
  }
  revoke(value: string): void { this.remove(digest(value)); this.schedule(); }
  dispose(): void {
    this.disposed = true;
    clearTimeout(this.timer); this.timer = undefined;
    for (const key of this.records.keys()) this.remove(key);
  }
}

export function createLanSessionStore(options: SessionOptions) {
  return new LanSessionStore(options);
}

/** Socket-peer failure budget; independent of the app's API admission budget. */
export function createLanAuthThrottle(options: {
  windowMs: number; maxFailures: number; maxBuckets: number; now?: () => number;
}) {
  const now = options.now ?? Date.now;
  const buckets = new Map<string, { failures: number; expiresAt: number }>();
  function prune() {
    for (const [peer, bucket] of buckets) if (bucket.expiresAt <= now()) buckets.delete(peer);
  }
  return {
    retryAfter(peer: string): number {
      prune();
      const bucket = buckets.get(peer);
      if (bucket && bucket.failures >= options.maxFailures) return Math.max(1, Math.ceil((bucket.expiresAt - now()) / 1000));
      if (!bucket && buckets.size >= options.maxBuckets) {
        return Math.max(1, Math.ceil((Math.min(...[...buckets.values()].map(b => b.expiresAt)) - now()) / 1000));
      }
      return 0;
    },
    fail(peer: string): void {
      prune();
      const bucket = buckets.get(peer);
      if (bucket) bucket.failures++;
      else if (buckets.size < options.maxBuckets) buckets.set(peer, { failures: 1, expiresAt: now() + options.windowMs });
    },
    dispose(): void { buckets.clear(); },
  };
}
