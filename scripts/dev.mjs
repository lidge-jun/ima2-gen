#!/usr/bin/env node
// Dev runner: build UI with VITE_IMA2_DEV=1, then launch server in watch mode.
// Node mode (and any other dev-only UI gates) read this flag.
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createServer } from "node:net";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PORT = Number(process.env.PORT || 3333);
const OAUTH_PORT = Number(process.env.OAUTH_PORT || 10531);

function checkPortAvailable(port, label) {
  return new Promise((resolve, reject) => {
    const probe = createServer()
      .once("error", (err) => {
        if (err?.code === "EADDRINUSE") {
          reject(new Error(`${label} port ${port} is already in use.`));
          return;
        }
        reject(err);
      })
      .once("listening", () => {
        probe.close(() => resolve());
      })
      .listen(port);
  });
}

function run(cmd, args, env = {}) {
  return spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...env },
    shell: process.platform === "win32",
  });
}

try {
  await checkPortAvailable(PORT, "Server");
  await checkPortAvailable(OAUTH_PORT, "OAuth proxy");
} catch (err) {
  console.error(`[dev] ${err.message}`);
  console.error("[dev] Stop the existing ima2/image_gen dev process first, then run npm run dev again.");
  process.exit(1);
}

console.log("[dev] building UI with VITE_IMA2_DEV=1 …");
const build = run("npm", ["run", "ui:build"], { VITE_IMA2_DEV: "1" });
if (build.status !== 0) process.exit(build.status ?? 1);

console.log("[dev] starting server with --watch …");
const server = spawn(process.execPath, ["--watch", "server.js"], {
  cwd: ROOT,
  stdio: "inherit",
  env: { ...process.env, IMA2_DEV: "1" },
});
server.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => server.kill(sig));
}
