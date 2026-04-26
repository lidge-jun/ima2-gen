#!/usr/bin/env node
// Dev runner: build UI with dev diagnostics enabled, then launch the watched server.
// Node mode is a product feature now; VITE_IMA2_DEV remains for future dev-only UI gates.
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function run(cmd, args, env = {}) {
  return spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...env },
    shell: process.platform === "win32",
  });
}

console.log("[dev] building UI with dev diagnostics …");
const build = run("npm", ["run", "ui:build"], {
  VITE_IMA2_DEV: "1",
  VITE_IMA2_CARD_NEWS: "1",
});
if (build.status !== 0) process.exit(build.status ?? 1);

console.log("[dev] starting server with --watch …");
console.log("[dev] port fallback is handled by server.js; check ~/.ima2/server.json for actual URLs.");
const server = spawn(process.execPath, ["--watch", "server.js"], {
  cwd: ROOT,
  stdio: "inherit",
  env: { ...process.env, IMA2_DEV: "1", IMA2_CARD_NEWS: "1" },
});
server.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => server.kill(sig));
}
