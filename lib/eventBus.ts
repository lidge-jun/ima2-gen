import { EventEmitter } from "node:events";
import type { JobEnvelopeV1 } from "./jobs/envelope.js";

export interface BusEvent {
  id: number;
  jobId: string;
  event: string;
  data: Record<string, unknown>;
  /** Per-job counter (#151). Distinct from `id`, which is a process-wide SSE cursor. */
  jobSeq?: number;
  /**
   * Immutable snapshot taken by the publisher (#151). Lives beside `data`, not
   * inside it, so subscribers comparing `event.data` are unaffected.
   */
  envelope?: JobEnvelopeV1;
}

/** Global replay window — sized for 7+ concurrent jobs (~15 events each) with reconnect headroom. */
export const RING_SIZE = 2000;
/** Align with /api/events connection cap — avoids MaxListenersExceededWarning under load. */
export const MAX_SSE_LISTENERS = 512;
const bus = new EventEmitter();
bus.setMaxListeners(MAX_SSE_LISTENERS);

let seq = 0;
const ring: BusEvent[] = [];
/**
 * Per-job sequence counters. Bounded by RING_SIZE with LRU eviction: a job whose
 * events have all aged out of the replay ring cannot have its sequence
 * questioned, so its counter has nothing left to protect. Deleting on terminal
 * instead would restart numbering for the late `error` that can still follow a
 * `done` (lib/ssePublish.ts only suppresses the reverse order).
 */
const jobSeqs = new Map<string, number>();

function nextJobSeq(jobId: string): number {
  const next = (jobSeqs.get(jobId) ?? 0) + 1;
  jobSeqs.delete(jobId);
  jobSeqs.set(jobId, next);
  if (jobSeqs.size > RING_SIZE) {
    const oldest = jobSeqs.keys().next();
    if (!oldest.done) jobSeqs.delete(oldest.value);
  }
  return next;
}

/** Reads a job's current sequence without allocating one. */
export function peekJobSeq(jobId: string): number {
  return jobSeqs.get(jobId) ?? 0;
}

function omitLargeImageFields(data: Record<string, unknown>): { data: Record<string, unknown>; omitted: boolean } {
  let omitted = false;
  const next: Record<string, unknown> = { ...data };
  if (typeof next.image === "string" && next.image.length > 1000) {
    delete next.image;
    omitted = true;
  }
  if (Array.isArray(next.images)) {
    const images = next.images.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return item;
      const imageItem = item as Record<string, unknown>;
      if (typeof imageItem.image !== "string" || imageItem.image.length <= 1000) return item;
      const { image: _omit, ...rest } = imageItem;
      omitted = true;
      return { ...rest, _imageOmitted: true };
    });
    if (omitted) next.images = images;
  }
  if (omitted) next._imageOmitted = true;
  return { data: omitted ? next : data, omitted };
}

function toRingEntry(entry: BusEvent): BusEvent {
  // Keep terminal/partial metadata replayable; omit multi-MB base64 from the ring.
  const stripped = omitLargeImageFields(entry.data);
  return stripped.omitted ? { ...entry, data: stripped.data } : entry;
}

/**
 * Publishes a job event.
 *
 * `meta.buildEnvelope` receives the sequence this call just allocated and
 * returns the snapshot to attach. It is a callback rather than a value because
 * the sequence is assigned here, and a callback rather than an injected module
 * because eventBus must not import inflight (routes/events.ts imports this
 * module, and pulling inflight in would open the user's database from any test
 * that imports the SSE route).
 */
export function publish(
  jobId: string,
  event: string,
  data: Record<string, unknown>,
  meta?: { buildEnvelope?: (sequence: number) => JobEnvelopeV1 | undefined },
): void {
  seq++;
  const jobSeq = nextJobSeq(jobId);
  let envelope: JobEnvelopeV1 | undefined;
  try {
    envelope = meta?.buildEnvelope?.(jobSeq);
  } catch {
    // An envelope is metadata. Never let building it drop the event itself.
    envelope = undefined;
  }
  const entry: BusEvent = {
    id: seq,
    jobId,
    event,
    data,
    jobSeq,
    ...(envelope === undefined ? {} : { envelope }),
  };
  const ringEntry = toRingEntry(entry);
  ring.push(ringEntry);
  if (ring.length > RING_SIZE) ring.shift();
  bus.emit("event", entry);
}

export function subscribe(listener: (ev: BusEvent) => void): () => void {
  bus.on("event", listener);
  return () => bus.off("event", listener);
}

export function replayOldestId(): number | null {
  return ring.length > 0 ? ring[0]?.id ?? null : null;
}

/** True when the ring has evicted events the client still expects from Last-Event-ID. */
export function hasReplayGap(lastEventId: number): boolean {
  if (lastEventId <= 0 || ring.length === 0) return false;
  const oldest = ring[0]?.id;
  if (oldest === undefined) return false;
  return lastEventId < oldest - 1;
}

export function replaySince(lastEventId: number): BusEvent[] {
  const idx = ring.findIndex(e => e.id > lastEventId);
  return idx === -1 ? [] : ring.slice(idx);
}

export function _resetForTest(): void {
  seq = 0;
  ring.length = 0;
  jobSeqs.clear();
  bus.removeAllListeners();
}
