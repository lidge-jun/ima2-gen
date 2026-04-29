// SSE consumer for CLI streaming endpoints. Plain fetch + line-based parser, no external libs.

let CLI_VERSION = "0.0.0";
export function setCliVersion(v: string) { CLI_VERSION = v; }

export type SseEvent = { event: string; data: any };

export interface SseInit {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Stream events from an SSE endpoint, yielding parsed events as `{ event, data }`.
 * - method defaults to "POST"
 * - JSON body is auto-stringified
 * - sets `Accept: text/event-stream` and `Content-Type: application/json` automatically
 * - parses chunk boundaries; partial events at EOF are dropped (not yielded)
 * - aborts cleanly on AbortSignal
 */
export async function* streamSse(url: string, init: SseInit = {}): AsyncGenerator<SseEvent> {
  const headers: Record<string, string> = {
    Accept: "text/event-stream",
    "Content-Type": "application/json",
    "X-ima2-client": `cli/${CLI_VERSION}`,
    ...(init.headers || {}),
  };
  const res = await fetch(url, {
    method: init.method || "POST",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: init.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch {}
    const err: any = new Error(parsed?.error || `SSE failed: HTTP ${res.status}`);
    err.status = res.status;
    err.code = parsed?.code || null;
    throw err;
  }
  if (!res.body) return;

  const decoder = new TextDecoder();
  let buf = "";
  for await (const chunk of res.body as any) {
    buf += decoder.decode(chunk, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const ev = parseFrame(frame);
      if (ev) yield ev;
    }
  }
}

function parseFrame(frame: string): SseEvent | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith(":")) continue;
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^\s/, ""));
  }
  if (dataLines.length === 0) return null;
  const raw = dataLines.join("\n");
  try { return { event, data: JSON.parse(raw) }; }
  catch { return { event, data: raw }; }
}
