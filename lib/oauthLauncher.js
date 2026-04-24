import { spawnBin } from "../bin/lib/platform.js";
import { config } from "../config.js";

export function startOAuthProxy(options = {}) {
  const oauthPort = options.oauthPort ?? config.oauth.proxyPort;
  const restartDelayMs = options.restartDelayMs ?? config.oauth.restartDelayMs;

  console.log(`Starting openai-oauth on port ${oauthPort}...`);
  const child = spawnBin("npx", ["openai-oauth", "--port", String(oauthPort)], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });

  child.stdout.on("data", (d) => {
    const msg = d.toString().trim();
    if (msg) console.log(`[oauth] ${msg}`);
  });

  child.stderr.on("data", (d) => {
    const msg = d.toString().trim();
    if (msg && !msg.includes("npm warn")) console.error(`[oauth] ${msg}`);
  });

  child.on("exit", (code) => {
    console.log(`[oauth] exited with code ${code}, restarting in ${Math.round(restartDelayMs / 1000)}s...`);
    setTimeout(() => startOAuthProxy(options), restartDelayMs);
  });

  return child;
}

