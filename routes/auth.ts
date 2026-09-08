import type { Express } from "express";
import type { RouteRuntimeContext } from "../lib/runtimeContext.js";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { codexFileLoginArgs, detectCodexAuth } from "../lib/codexDetect.js";
import { packageCliCommand } from "../lib/packageCli.js";
import {
  XAI_OAUTH_CLIENT_ID as GROK_CLIENT_ID,
  XAI_OAUTH_SCOPE as GROK_SCOPE,
  XAI_TOKEN_ENDPOINT_FALLBACK as GROK_TOKEN_URL,
  loadGrokCredentials,
  saveGrokCredentials,
  type GrokCredentials,
} from "../lib/xaiAuth.js";

const CODEX_DEVICE_CODE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

interface AuthSession {
  provider: "grok" | "codex";
  userCode: string;
  verificationUrl: string;
  expiresAt: number;
  status: "pending" | "complete" | "error" | "expired";
  error?: string;
  pollTimer?: ReturnType<typeof setInterval>;
  child?: ChildProcess;
  deviceCode?: string;
}

const MAX_CONCURRENT_SESSIONS = 20;
const sessions = new Map<string, AuthSession>();

function sid(): string {
  return randomBytes(16).toString("hex");
}

function cleanup(id: string) {
  const s = sessions.get(id);
  if (s?.pollTimer) clearInterval(s.pollTimer);
  if (s?.child && !s.child.killed) s.child.kill();
  if (s) delete s.deviceCode;
  setTimeout(() => sessions.delete(id), 120_000);
}

function stripAnsi(s: string): string {
  return s.replace(/\x1B\[[0-9;]*m/g, "");
}

function saveGrokTokens(tokens: Record<string, unknown>) {
  if (typeof tokens.access_token !== "string" || tokens.access_token.length === 0) {
    throw new Error("xAI token response did not include an access token");
  }
  let email: string | undefined;
  if (typeof tokens.id_token === "string") {
    try {
      const segment = tokens.id_token.split(".")[1];
      if (!segment) throw new Error("missing jwt payload");
      const payload = JSON.parse(Buffer.from(segment, "base64url").toString());
      email = payload.email;
    } catch { /* ignore */ }
  }
  // Merge over the existing file so a field only progrok writes (idToken) survives a
  // fresh login; the atomic 0600 write itself lives in lib/xaiAuth.ts.
  const data: GrokCredentials = {
    ...(loadGrokCredentials() ?? {}),
    accessToken: tokens.access_token,
    ...(typeof tokens.refresh_token === "string" ? { refreshToken: tokens.refresh_token } : {}),
    ...(typeof tokens.expires_in === "number" ? { expiresAt: Date.now() + tokens.expires_in * 1000 } : {}),
    tokenEndpoint: GROK_TOKEN_URL,
    ...(typeof tokens.id_token === "string" ? { idToken: tokens.id_token } : {}),
    ...(email ? { email } : {}),
  };
  saveGrokCredentials(data);
}

async function startGrokDeviceCode(): Promise<{ sessionId: string; userCode: string; verificationUrl: string; expiresIn: number }> {
  const discovery = await fetch("https://auth.x.ai/.well-known/openid-configuration", { signal: AbortSignal.timeout(10000) });
  const disc = await discovery.json() as { device_authorization_endpoint?: string; token_endpoint: string };
  if (!disc.device_authorization_endpoint) throw new Error("xAI does not expose device_authorization_endpoint");

  const res = await fetch(disc.device_authorization_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: GROK_CLIENT_ID, scope: GROK_SCOPE }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Device code request failed: ${res.status}`);
  const dc = await res.json() as {
    device_code: string; user_code: string;
    verification_uri: string; verification_uri_complete?: string;
    expires_in: number; interval?: number;
  };

  const id = sid();
  const session: AuthSession = {
    provider: "grok",
    userCode: dc.user_code,
    verificationUrl: dc.verification_uri_complete || dc.verification_uri,
    expiresAt: Date.now() + dc.expires_in * 1000,
    status: "pending",
    deviceCode: dc.device_code,
  };
  sessions.set(id, session);

  const interval = Math.max((dc.interval || 5) * 1000, 5000);
  session.pollTimer = setInterval(async () => {
    if (session.status !== "pending") { cleanup(id); return; }
    if (Date.now() > session.expiresAt) { session.status = "expired"; cleanup(id); return; }
    try {
      const tokenRes = await fetch(disc.token_endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: CODEX_DEVICE_CODE_GRANT,
          client_id: GROK_CLIENT_ID,
          device_code: dc.device_code,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (tokenRes.ok) {
        const tokens = await tokenRes.json() as Record<string, unknown>;
        saveGrokTokens(tokens);
        session.status = "complete";
        cleanup(id);
        return;
      }
      const err = await tokenRes.json() as { error?: string };
      if (err.error !== "authorization_pending" && err.error !== "slow_down") {
        session.status = "error";
        session.error = err.error || "unknown";
        cleanup(id);
      }
    } catch { /* network error, keep polling */ }
  }, interval);

  return { sessionId: id, userCode: dc.user_code, verificationUrl: session.verificationUrl, expiresIn: dc.expires_in };
}

function startCodexDeviceCode(): Promise<{ sessionId: string; userCode: string; verificationUrl: string; expiresIn: number }> {
  return new Promise((resolve, reject) => {
    // Don't hand other providers' secrets to the codex child — it only needs
    // PATH/HOME/codex config to run the ChatGPT device-code login.
    const childEnv = { ...process.env };
    for (const k of ["OPENAI_API_KEY", "XAI_API_KEY", "GEMINI_API_KEY", "ANTHROPIC_API_KEY", "VERTEX_SERVICE_ACCOUNT_JSON", "ATLASCLOUD_API_KEY", "MINIMAX_API_KEY"]) {
      delete childEnv[k];
    }
    const codex = packageCliCommand(
      "@openai/codex",
      "codex",
      codexFileLoginArgs({ deviceAuth: true }),
    );
    const child = spawn(codex.command, codex.args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: childEnv,
      shell: false,
      windowsHide: true,
    });

    let stdout = "";
    let resolved = false;
    const id = sid();

    const session: AuthSession = {
      provider: "codex",
      userCode: "",
      verificationUrl: "",
      expiresAt: Date.now() + 15 * 60 * 1000,
      status: "pending",
      child,
    };
    sessions.set(id, session);

    // Server-side reaper: if the client abandons the flow (closes browser, stops
    // polling), kill the lingering codex child instead of waiting for it to self-exit.
    const reaper = setTimeout(() => {
      if (session.status === "pending") {
        session.status = "expired";
        cleanup(id);
      }
    }, 16 * 60 * 1000);
    reaper.unref?.();

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      if (resolved) return;

      const clean = stripAnsi(stdout);
      const urlMatch = clean.match(/https:\/\/auth\.openai\.com\/codex\/device/);
      const codeMatch = clean.match(/^\s+([A-Z0-9]{4}-[A-Z0-9]{4,5})\s*$/m);

      if (urlMatch && codeMatch) {
        resolved = true;
        const userCode = codeMatch[1];
        if (!userCode) return;
        session.userCode = userCode;
        session.verificationUrl = urlMatch[0];
        resolve({
          sessionId: id,
          userCode,
          verificationUrl: urlMatch[0],
          expiresIn: 900,
        });
      }
    });

    child.stderr?.on("data", () => { /* ignore */ });

    child.on("close", (code) => {
      if (!resolved) {
        sessions.delete(id);
        reject(new Error(`codex login exited with code ${code} before providing device code`));
        return;
      }
      const proxyReady = code === 0 && detectCodexAuth().proxyReady;
      session.status = proxyReady ? "complete" : "error";
      if (code !== 0) session.error = `codex exited with code ${code}`;
      else if (!proxyReady) session.error = "Codex login did not create a file-backed GPT OAuth session";
      cleanup(id);
    });

    child.on("error", (err) => {
      if (!resolved) {
        sessions.delete(id);
        reject(new Error(`codex not found: ${err.message}`));
        return;
      }
      session.status = "error";
      session.error = err.message;
      cleanup(id);
    });

    setTimeout(() => {
      if (!resolved) {
        sessions.delete(id);
        if (!child.killed) child.kill();
        reject(new Error("Timed out waiting for codex device code output"));
      }
    }, 30000);
  });
}

/** `_ctx` is accepted only to keep the registration signature uniform in
 *  routes/index.ts; the device-code flow writes credentials to disk and no
 *  longer notifies any in-process supervisor. */
export function registerAuthRoutes(app: Express, _ctx?: RouteRuntimeContext) {
  app.post("/api/auth/switch", async (req, res) => {
    const provider = req.body?.provider;
    if (provider !== "grok" && provider !== "codex") {
      return res.status(400).json({ error: "provider must be grok or codex" });
    }
    if (sessions.size >= MAX_CONCURRENT_SESSIONS) {
      return res.status(429).json({ error: "Too many pending auth sessions" });
    }
    try {
      const result = provider === "grok"
        ? await startGrokDeviceCode()
        : await startCodexDeviceCode();
      res.json(result);
    } catch (e) {
      res.status(502).json({ error: (e as Error).message });
    }
  });

  app.get("/api/auth/switch/:sessionId", (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session) return res.status(404).json({ status: "expired" });
    if (session.status === "complete") return res.json({ status: "complete" });
    if (session.status === "error") return res.json({ status: "error", error: session.error });
    if (Date.now() > session.expiresAt) {
      session.status = "expired";
      cleanup(req.params.sessionId);
      return res.json({ status: "expired" });
    }
    res.json({ status: "pending" });
  });
}
