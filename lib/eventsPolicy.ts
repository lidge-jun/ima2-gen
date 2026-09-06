/** Maximum time one accepted SSE write may wait for drain. */
export const SSE_STREAM_POLICY = Object.freeze({ drainTimeoutMs: 15_000 });

/** Parse the replay cursor header without accepting numeric coercions or overflow. */
export function parseEventCursor(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const cursor = Number(value);
  return Number.isSafeInteger(cursor) ? cursor : null;
}
