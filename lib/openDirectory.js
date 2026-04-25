import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";

export async function openDirectory(dir, options = {}) {
  await mkdir(dir, { recursive: true });
  const platform = options.platform || process.platform;
  const spawnImpl = options.spawnImpl || spawn;
  const command =
    platform === "darwin" ? "open"
    : platform === "win32" ? "explorer"
    : "xdg-open";

  return new Promise((resolve) => {
    try {
      const child = spawnImpl(command, [dir], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      let settled = false;
      const done = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      child.on("error", (err) => {
        done({ ok: false, error: err.message || String(err) });
      });
      child.unref?.();
      setTimeout(() => done({ ok: true }), 50).unref?.();
    } catch (err) {
      resolve({ ok: false, error: err?.message || String(err) });
    }
  });
}
