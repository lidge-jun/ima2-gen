// Cross-platform helpers (Windows / macOS / Linux / WSL).
// Keep this file tiny & dependency-free. Node 18+ only.

import { spawn, execSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { errInfo } from "../../lib/errInfo.js";
export const isWin = process.platform === "win32";
export const isMac = process.platform === "darwin";
export const isLinux = !isWin && !isMac;

let _wslCached: boolean | null = null;
export function isWsl() {
  if (_wslCached !== null) return _wslCached;
  if (!isLinux) return (_wslCached = false);
  try {
    _wslCached = readFileSync("/proc/version", "utf-8").toLowerCase().includes("microsoft");
  } catch {
    _wslCached = false;
  }
  return _wslCached;
}

export function hasDesktopSession() {
  return Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
}

/**
 * Resolve an executable name that differs between Windows and Unix.
 * On Windows, npm global shims are .cmd files; spawn() without shell:true
 * cannot resolve them and fails with ENOENT.
 */
export function resolveBin(name: string) {
  return isWin ? `${name}.cmd` : name;
}

/**
 * spawn() wrapper that works for npm/npx/any PATH-resolved exe on Windows.
 */
export function spawnBin(name: string, args: string[], opts: Parameters<typeof spawn>[2] = {}) {
  if (isWin) {
    // Node 24 on Windows can throw EINVAL when spawning PATH-resolved .cmd
    // shims directly with piped stdio. Routing through cmd.exe avoids that.
    return spawn("cmd.exe", ["/d", "/s", "/c", `${name} ${args.join(" ")}`], {
      windowsHide: true,
      ...opts,
    });
  }
  return spawn(resolveBin(name), args, { windowsHide: true, ...opts });
}

/**
 * Open a URL in the user's default browser.
 * Returns { ok: boolean, error?: string }.
 * Handles WSL (via powershell.exe) and refuses on headless Linux without DISPLAY.
 */
export function openUrl(url: string): { ok: boolean; error?: string } {
  try {
    if (isMac) {
      execSync(`open ${JSON.stringify(url)}`, { stdio: "ignore" });
    } else if (isWin) {
      execSync(`cmd /c start "" ${JSON.stringify(url)}`, { stdio: "ignore" });
    } else if (isWsl()) {
      // WSL: hand off to Windows via powershell
      execSync(`powershell.exe -NoProfile -Command Start-Process ${JSON.stringify(url)}`, { stdio: "ignore" });
    } else {
      if (!hasDesktopSession()) {
        return { ok: false, error: "no desktop session (DISPLAY/WAYLAND_DISPLAY unset)" };
      }
      execSync(`xdg-open ${JSON.stringify(url)}`, { stdio: "ignore" });
    }
    return { ok: true };
  } catch (e) {
    const err = errInfo(e);
    return { ok: false, error: err.message || String(e) };
  }
}

/**
 * Register graceful shutdown handlers.
 * Windows does NOT raise SIGTERM from the OS — SIGINT (Ctrl+C) and SIGBREAK
 * (Ctrl+Break) are the observable signals. We still register SIGTERM so that
 * Node-internal `child.kill("SIGTERM")` calls work in tests.
 */
export function onShutdown(handler: (signal: NodeJS.Signals) => void) {
  const signals: NodeJS.Signals[] = isWin
    ? ["SIGINT", "SIGTERM", "SIGBREAK"]
    : ["SIGINT", "SIGTERM", "SIGHUP"];
  for (const sig of signals) {
    try {
      process.on(sig, () => {
        try { handler(sig); } finally { process.exit(0); }
      });
    } catch {
      // Some signals aren't installable on certain platforms; ignore.
    }
  }
}

