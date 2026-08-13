export async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
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
