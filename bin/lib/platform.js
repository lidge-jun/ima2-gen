// Cross-platform helpers (Windows / macOS / Linux).
// Keep this file tiny & dependency-free. Node 18+ only.

import { spawn, execSync } from "node:child_process";

export const isWin = process.platform === "win32";
export const isMac = process.platform === "darwin";
export const isLinux = !isWin && !isMac;

/**
 * Resolve an executable name that differs between Windows and Unix.
 * On Windows, npm global shims are .cmd files; spawn() without shell:true
 * cannot resolve them and fails with ENOENT.
 */
export function resolveBin(name) {
  return isWin ? `${name}.cmd` : name;
}

/**
 * spawn() wrapper that works for npm/npx/any PATH-resolved exe on Windows.
 * Uses `.cmd` suffix on Windows instead of shell:true to keep stdio/env pristine
 * and avoid quoting pitfalls.
 */
export function spawnBin(name, args, opts = {}) {
  return spawn(resolveBin(name), args, opts);
}

/**
 * Open a URL in the user's default browser.
 * - macOS:  `open <url>`
 * - Windows: `cmd /c start "" "<url>"`  (start is a cmd builtin)
 * - Linux:   `xdg-open <url>`  (may be missing on headless servers)
 * Returns { ok: boolean, error?: string }.
 */
export function openUrl(url) {
  try {
    if (isMac) {
      execSync(`open ${JSON.stringify(url)}`, { stdio: "ignore" });
    } else if (isWin) {
      // Empty quoted title prevents start from interpreting the URL as a window title.
      execSync(`cmd /c start "" ${JSON.stringify(url)}`, { stdio: "ignore" });
    } else {
      execSync(`xdg-open ${JSON.stringify(url)}`, { stdio: "ignore" });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

/**
 * Register graceful shutdown handlers. Windows does NOT raise SIGTERM from
 * the OS (only from inside Node), but SIGINT and SIGBREAK do work for
 * Ctrl+C and Ctrl+Break respectively.
 */
export function onShutdown(handler) {
  const signals = isWin ? ["SIGINT", "SIGBREAK"] : ["SIGINT", "SIGTERM", "SIGHUP"];
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
