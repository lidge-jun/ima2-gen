type EventHandler = (event: string, data: Record<string, unknown>) => void;

interface Subscription {
  jobId: string;
  event: string | null;
  handler: EventHandler;
}

/**
 * Max wait for done/error after async POST accepts the job (90 min).
 *
 * Must stay ABOVE the server's worst case for one request — Grok video is
 * 1500 s planning + 300 s start + 1800 s poll + 300 s poll overshoot + 300 s download
 * = 4200 s — or the UI cancels generations the server would have finished and reports
 * them as stream timeouts.
 * devlog/_plan/260817_grok_video_planner_timeout/010_timeout_budgets.md
 */
export const JOB_STREAM_TIMEOUT_MS = 90 * 60 * 1000;

const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 30_000;

let source: EventSource | null = null;
let lastEventId = "";
const subs: Set<Subscription> = new Set();
let resyncCallback: (() => void) | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let wasEverConnected = false;
let reconnectAttempt = 0;

export type ConnectionState = "connected" | "reconnecting" | "failed";
const FAILED_THRESHOLD = 3;
let connectionStateCallback: ((state: ConnectionState) => void) | null = null;

const EVENT_TYPES = ["phase", "partial", "image", "done", "error", "submitted", "progress", "planning", "keying-start", "keying-progress", "keying-done", "keying-error"];

function buildEventsUrl(): string {
  if (!lastEventId) return "/api/events";
  return `/api/events?lastEventId=${encodeURIComponent(lastEventId)}`;
}

function connect() {
  if (source && source.readyState !== EventSource.CLOSED) return;
  source = new EventSource(buildEventsUrl());

  source.onopen = () => {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    reconnectAttempt = 0;
    if (wasEverConnected) resyncCallback?.();
    wasEverConnected = true;
    connectionStateCallback?.("connected");
  };

  for (const type of EVENT_TYPES) {
    source.addEventListener(type, (ev: Event) => dispatch(type, ev as MessageEvent));
  }

  source.onerror = () => {
    source?.close();
    source = null;
    const baseDelay = Math.min(
      RECONNECT_BASE_MS * Math.pow(1.5, reconnectAttempt),
      RECONNECT_MAX_MS,
    );
    const delay = Math.min(baseDelay * (0.8 + Math.random() * 0.4), RECONNECT_MAX_MS);
    reconnectAttempt += 1;
    connectionStateCallback?.(reconnectAttempt >= FAILED_THRESHOLD ? "failed" : "reconnecting");
    reconnectTimer = setTimeout(connect, delay);
  };
}

function dispatch(eventType: string, ev: MessageEvent) {
  if (ev.lastEventId) lastEventId = ev.lastEventId;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(ev.data);
  } catch {
    if (import.meta.env.DEV) {
      console.warn(`[eventChannel] invalid JSON for "${eventType}"`, ev.data);
    }
    return;
  }
  const jobId = (data.jobId ?? data.requestId ?? "") as string;
  if (!jobId) {
    if (import.meta.env.DEV) {
      console.warn(`[eventChannel] missing jobId on "${eventType}"`, data);
    }
    return;
  }
  for (const sub of subs) {
    if (sub.jobId !== jobId) continue;
    if (sub.event !== null && sub.event !== eventType) continue;
    sub.handler(eventType, data);
  }
}

export function subscribe(
  jobId: string,
  event: string | null,
  handler: EventHandler,
): () => void {
  const sub: Subscription = { jobId, event, handler };
  subs.add(sub);
  if (!source || source.readyState === EventSource.CLOSED) connect();
  return () => { subs.delete(sub); };
}

export function armStreamTimeout(onTimeout: () => void, ms = JOB_STREAM_TIMEOUT_MS): () => void {
  const timer = setTimeout(onTimeout, ms);
  return () => clearTimeout(timer);
}

export function onResync(cb: () => void) {
  resyncCallback = cb;
}

export function onConnectionStateChange(cb: (state: ConnectionState) => void) {
  connectionStateCallback = cb;
}

export function disconnect() {
  source?.close();
  source = null;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  subs.clear();
  lastEventId = "";
  wasEverConnected = false;
  reconnectAttempt = 0;
  resyncCallback = null;
  connectionStateCallback = null;
}

export function ensureConnected() {
  if (!source || source.readyState === EventSource.CLOSED) connect();
}

/**
 * Resolve once the SSE transport is OPEN (immediately if already open).
 * Subscribers that submit a job right after subscribing must await this —
 * otherwise a terminal event emitted before the server-side subscription is
 * installed is lost on a fresh connection (no Last-Event-ID replay exists).
 */
export function whenConnected(timeoutMs = 10_000): Promise<void> {
  ensureConnected();
  if (source && source.readyState === EventSource.OPEN) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    // Poll readyState instead of onConnectionStateChange — that callback is a
    // singleton owned by the store and must not be clobbered.
    const tick = () => {
      if (source && source.readyState === EventSource.OPEN) {
        resolve();
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error("SSE channel open timed out"));
        return;
      }
      setTimeout(tick, 50);
    };
    tick();
  });
}
