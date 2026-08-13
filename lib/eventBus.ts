import { EventEmitter } from "node:events";

export interface BusEvent {
  id: number;
  jobId: string;
  event: string;
  data: Record<string, unknown>;
}

/** Global replay window — sized for 7+ concurrent jobs (~15 events each) with reconnect headroom. */
export const RING_SIZE = 2000;
/** Align with /api/events connection cap — avoids MaxListenersExceededWarning under load. */
export const MAX_SSE_LISTENERS = 512;
const bus = new EventEmitter();
bus.setMaxListeners(MAX_SSE_LISTENERS);

let seq = 0;
const ring: BusEvent[] = [];

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

export function publish(jobId: string, event: string, data: Record<string, unknown>): void {
  seq++;
  const entry: BusEvent = { id: seq, jobId, event, data };
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
  bus.removeAllListeners();
}
