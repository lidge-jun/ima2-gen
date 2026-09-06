import { createLanAuthError, getLanAuthEpoch, isLanSessionLocked, requireLanAuthentication } from "./lanSession";

/** Observe first-party auth failures without changing caller transport options. */
export async function fetchApi(url: string, init?: RequestInit): Promise<Response> {
  const epoch = getLanAuthEpoch();
  let protectedRequest = false;
  try {
    if (typeof window !== "undefined") {
      const target = new URL(url, window.location.href);
      protectedRequest = target.origin === window.location.origin
        && /^\/(api|generated)(?:\/|$)/i.test(target.pathname);
    }
  } catch { /* Native fetch retains responsibility for invalid URLs. */ }
  try {
    if (protectedRequest) init?.signal?.throwIfAborted();
    // A locked-period rejection belongs to the invalidated auth period, too.
    // Login preserves the loss epoch, so stamping its current value would relock it.
    if (protectedRequest && isLanSessionLocked()) throw createLanAuthError(epoch - 1);
    const response = await fetch(url, init);
    if (protectedRequest && response.status === 401) {
      const body: unknown = await response.clone().json().catch(() => null);
      const error = (body as { error?: { code?: unknown }; code?: unknown } | null);
      if (error?.error?.code === "LAN_TOKEN_REQUIRED" || error?.code === "LAN_TOKEN_REQUIRED") {
        requireLanAuthentication(epoch);
        try { await response.body?.cancel(); } catch { /* Preserve the typed auth failure if cleanup fails. */ }
        throw createLanAuthError(epoch);
      }
    }
    return response;
  } catch (error) { throw error; }
}

export async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetchApi(url, init);
  const data = (await res.json().catch(() => ({}))) as T & {
    error?: string | { code?: string; message?: string };
    currentVersion?: number;
  };
  if (!res.ok) {
    const raw = (data as { error?: string | { code?: string; message?: string }; code?: string })
      .error;
    const topCode = (data as { code?: string }).code;
    const message =
      typeof raw === "string"
        ? raw
        : raw?.message ?? `Request failed: ${res.status}`;
    const body = data as {
      code?: string;
      rawCode?: string;
      errorClass?: string;
      error?: string | { code?: string; message?: string; rawCode?: string; errorClass?: string };
    };
    const nested = typeof body.error === "object" && body.error ? body.error : undefined;
    const err = new Error(message) as Error & {
      status?: number;
      code?: string;
      rawCode?: string;
      errorClass?: string;
      currentVersion?: number;
    };
    err.status = res.status;
    if (nested?.code) err.code = nested.code;
    else if (topCode) err.code = topCode;
    const rawCode = nested?.rawCode ?? body.rawCode;
    const errorClass = nested?.errorClass ?? body.errorClass;
    if (typeof rawCode === "string") err.rawCode = rawCode;
    if (typeof errorClass === "string") err.errorClass = errorClass;
    if (typeof data.currentVersion === "number") {
      err.currentVersion = data.currentVersion;
    }
    throw err;
  }
  return data;
}

export async function jsonGetObservation(url: string, signal?: AbortSignal): Promise<unknown> {
  signal?.throwIfAborted();
  const res = await fetchApi(url, { method: "GET", signal });
  if (!res.ok) {
    try { await res.body?.cancel(); } catch { /* Preserve the HTTP status if cleanup fails. */ }
    const error = new Error(`Request failed: ${res.status}`) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  signal?.throwIfAborted();
  const data = await res.json();
  signal?.throwIfAborted();
  return data;
}
export function parseSseBlock(block: string): { event: string | null; data: unknown } | null {
  let event: string | null = null;
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0) return null;
  const raw = dataLines.join("\n");
  if (!raw || raw === "[DONE]") return null;
  return { event, data: JSON.parse(raw) as unknown };
}
let _browserId: string | null = null;
export function getBrowserId(): string {
  if (!_browserId) {
    const raw = localStorage.getItem("ima2.browserId");
    if (raw) _browserId = raw;
    else {
      _browserId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem("ima2.browserId", _browserId);
    }
  }
  return _browserId;
}

export function jsonFetchWithBrowserId<T>(url: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
    "X-Ima2-Browser-Id": getBrowserId(),
  };
  return jsonFetch<T>(url, { ...init, headers });
}
