// Codex CLI / OAuth auth detection across platforms.
// References:
// - OpenAI Codex stores auth under CODEX_HOME (default ~/.codex/auth.json).
// - Legacy chatgpt-local stores auth under ~/.chatgpt-local/auth.json.
// - Auth may live in OS keyring instead of a file (file absence ≠ unauth).
// - Windows has no documented native install path; WSL is the supported path.
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const HOME = homedir();

export function codexAuthPaths() {
  const codexHome = process.env.CODEX_HOME || join(HOME, ".codex");
  return {
    codex: join(codexHome, "auth.json"),
    chatgpt: join(HOME, ".chatgpt-local", "auth.json"),
    xdgCodex: join(HOME, ".config", "codex", "auth.json"),
  };
}

export function hasAuthFile() {
  const p = codexAuthPaths();
  return existsSync(p.codex) || existsSync(p.chatgpt) || existsSync(p.xdgCodex);
}

// Non-invasive probe: `codex login status` returns 0 when authed (file OR keyring).
// Returns: "authed" | "unauthed" | "missing" (codex binary not found)
export function codexLoginStatus(timeoutMs = 2000) {
  const candidates =
    process.platform === "win32"
      ? ["codex.cmd", "codex.exe", "codex"]
      : ["codex"];
  for (const bin of candidates) {
    try {
      execFileSync(bin, ["login", "status"], {
        stdio: "ignore",
        timeout: timeoutMs,
        windowsHide: true,
      });
      return "authed";
    } catch (err) {
      if (err && err.code === "ENOENT") continue;
      // non-zero exit = binary exists but not authed
      if (err && typeof err.status === "number") return "unauthed";
    }
  }
  return "missing";
}

export function detectCodexAuth() {
  const files = codexAuthPaths();
  const fileHits = {
    codex: existsSync(files.codex),
    chatgpt: existsSync(files.chatgpt),
    xdgCodex: existsSync(files.xdgCodex),
  };
  const probe = codexLoginStatus();
  const authed = probe === "authed" || fileHits.codex || fileHits.chatgpt || fileHits.xdgCodex;
  return {
    authed,
    probe,
    files,
    fileHits,
    platform: process.platform,
    wslHint: process.platform === "win32",
  };
}
