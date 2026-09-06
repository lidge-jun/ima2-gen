export interface LanSessionStatus {
  mode: "local" | "lan";
  authenticated: boolean;
  expiresAt: number | null;
}

export const LAN_AUTH_REQUIRED_EVENT = "ima2:lan-auth-required";
const SESSION_PATH = "/api/auth/lan/session";
const REQUEST_TIMEOUT_MS = 10_000;
const MESSAGES: Record<string, string> = {
  LAN_TOKEN_REQUIRED: "Connect to this studio again with its LAN token.",
  LAN_RATE_LIMITED: "Too many sign-in attempts. Wait before trying again.",
  LAN_SESSION_CAPACITY: "This studio has reached its session limit. Try again later.",
  LOCAL_HOST_REJECTED: "This studio address is not configured for access.",
  LOCAL_ORIGIN_REJECTED: "Open the studio using its configured address.",
  LAN_SESSION_UNAVAILABLE: "The studio could not be reached. Check its address and try again.",
  LAN_COOKIE_REQUIRED: "The browser did not retain the studio session cookie. Allow cookies for this address.",
  LAN_TOKEN_DUPLICATE: "The address contained more than one token. Enter the studio token below.",
};

type SessionError = Error & { code: string; status?: number; retryAfter?: number; authEpoch?: number };
let state: LanSessionStatus | null = null;
let authEpoch = 0;
let observationRevision = 0;
let pendingStatus: Promise<LanSessionStatus> | null = null;

function failure(code: string, status?: number, retryAfter?: number): SessionError {
  const knownCode = Object.hasOwn(MESSAGES, code) ? code : "LAN_SESSION_UNAVAILABLE";
  const error = new Error(MESSAGES[knownCode]) as SessionError;
  error.code = knownCode;
  if (status !== undefined) error.status = status;
  if (retryAfter !== undefined) error.retryAfter = retryAfter;
  return error;
}

export function getLanSessionState(): LanSessionStatus | null {
  return state ? { ...state } : null;
}

export function isLanSessionLocked(): boolean {
  return state?.mode === "lan" && !state.authenticated;
}

export function getLanAuthEpoch(): number { return authEpoch; }

/** Stamp errors so late work from an old auth period cannot lock a new session. */
export function createLanAuthError(epoch = authEpoch): Error & {
  code: "LAN_TOKEN_REQUIRED"; status: 401; authEpoch: number;
} {
  return Object.assign(new Error(MESSAGES.LAN_TOKEN_REQUIRED), {
    code: "LAN_TOKEN_REQUIRED" as const, status: 401 as const, authEpoch: epoch,
  });
}

export function requireLanAuthentication(expectedEpoch = authEpoch): void {
  if (expectedEpoch !== authEpoch || isLanSessionLocked()) return;
  authEpoch += 1;
  observationRevision += 1;
  state = { mode: "lan", authenticated: false, expiresAt: null };
  if (typeof window !== "undefined") window.dispatchEvent(new Event(LAN_AUTH_REQUIRED_EVENT));
}

function parseStatus(value: unknown): LanSessionStatus {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw failure("LAN_SESSION_UNAVAILABLE");
  const data = value as Record<string, unknown>;
  if ((data.mode !== "local" && data.mode !== "lan") || typeof data.authenticated !== "boolean"
    || (data.expiresAt !== null && (typeof data.expiresAt !== "number" || !Number.isFinite(data.expiresAt)))) {
    throw failure("LAN_SESSION_UNAVAILABLE");
  }
  if (data.mode === "local" && !data.authenticated) throw failure("LAN_SESSION_UNAVAILABLE");
  return { mode: data.mode, authenticated: data.authenticated, expiresAt: data.expiresAt as number | null };
}

async function sessionRequest(method: "GET" | "POST" | "DELETE", token = ""): Promise<LanSessionStatus | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(SESSION_PATH, {
      method, credentials: "same-origin", cache: "no-store", signal: controller.signal,
      ...(method === "POST" ? {
        headers: { "Content-Type": "application/json", "X-Ima2-Token": token }, body: "{}",
      } : {}),
    });
    if (response.status === 204 && method !== "GET") return null;
    const data: unknown = await response.json();
    if (!response.ok) {
      const nested = (data as { error?: { code?: unknown } } | null)?.error;
      const code = response.status === 429 ? "LAN_RATE_LIMITED"
        : typeof nested?.code === "string" ? nested.code : "LAN_SESSION_UNAVAILABLE";
      const retry = Number(response.headers.get("Retry-After"));
      throw failure(code, response.status, Number.isFinite(retry) && retry > 0 ? Math.min(retry, 3600) : undefined);
    }
    if (method !== "GET") throw failure("LAN_SESSION_UNAVAILABLE");
    return parseStatus(data);
  } catch (error) {
    if (error instanceof Error && "code" in error && typeof error.code === "string" && Object.hasOwn(MESSAGES, error.code)) {
      throw error;
    }
    throw failure("LAN_SESSION_UNAVAILABLE");
  } finally {
    token = "";
    clearTimeout(timer);
  }
}

async function readStatus(allowUnlock: boolean, revision = observationRevision): Promise<LanSessionStatus> {
  try {
    const next = await sessionRequest("GET");
    if (!next) throw failure("LAN_SESSION_UNAVAILABLE");
    if (revision !== observationRevision) {
      if (state) return { ...state };
      throw failure("LAN_SESSION_UNAVAILABLE");
    }
    if (next.mode === "lan" && !next.authenticated) {
      requireLanAuthentication();
    } else if (allowUnlock || !isLanSessionLocked()) {
      state = next;
    }
    return { ...(state ?? next) };
  } catch (error) { throw error; }
}

/** Reconnect/media observations coalesce, but can never silently sign back in. */
export function refreshLanSession(): Promise<LanSessionStatus> {
  if (pendingStatus) return pendingStatus;
  const request = readStatus(false);
  pendingStatus = request;
  const clear = () => { if (pendingStatus === request) pendingStatus = null; };
  void request.then(clear, clear);
  return request;
}

export async function createLanSession(token: string): Promise<void> {
  const revision = ++observationRevision;
  try {
    await sessionRequest("POST", token);
    if (revision !== observationRevision) throw createLanAuthError();
    // This fresh GET must not reuse an observation made before Set-Cookie.
    const status = await readStatus(true, revision);
    if (!status.authenticated) throw failure("LAN_COOKIE_REQUIRED");
  } catch (error) { throw error; }
  finally { token = ""; }
}

export async function endLanSession(): Promise<void> {
  const revision = ++observationRevision;
  try {
    await sessionRequest("DELETE");
    if (revision !== observationRevision) return;
    if (state?.mode === "lan") requireLanAuthentication();
  } catch (error) { throw error; }
}

export async function bootstrapLanSession(): Promise<{ mode: "local" | "lan"; authenticated: boolean }> {
  // Capture and remove every token synchronously, before any fetch or App import.
  const url = new URL(window.location.href);
  const values = url.searchParams.getAll("token");
  const supplied = values.length === 1;
  if (values.length) {
    url.searchParams.delete("token");
    window.history.replaceState(window.history.state, "", url.href);
  }
  if (values.length > 1) {
    values.fill("");
    throw failure("LAN_TOKEN_DUPLICATE");
  }
  let token = values[0] ?? "";
  values.fill("");
  try {
    if (supplied) await createLanSession(token);
    else await readStatus(true);
    if (!state) throw failure("LAN_SESSION_UNAVAILABLE");
    return { mode: state.mode, authenticated: state.authenticated };
  } catch (error) { throw error; }
  finally { token = ""; }
}
