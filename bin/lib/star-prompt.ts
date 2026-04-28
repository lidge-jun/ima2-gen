import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { config } from "../../config.js";

const REPO = "lidge-jun/ima2-gen";

export function starPromptStatePath() {
  return join(config.storage.configDir, "state", "star-prompt.json");
}

export async function hasBeenPrompted() {
  const path = starPromptStatePath();
  if (!existsSync(path)) return false;
  try {
    const content = await readFile(path, "utf8");
    const state = JSON.parse(content);
    return typeof state.prompted_at === "string";
  } catch {
    return false;
  }
}

export async function markPrompted() {
  const path = starPromptStatePath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify({ prompted_at: new Date().toISOString() }, null, 2));
}

export function isGhInstalled() {
  const result = spawnSync("gh", ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "ignore", "ignore"],
    timeout: 3000,
    windowsHide: true,
  });
  return !result.error && result.status === 0;
}

export function starRepo(spawnSyncFn = spawnSync) {
  const result = spawnSyncFn("gh", ["api", "-X", "PUT", `/user/starred/${REPO}`], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 10000,
    windowsHide: true,
  });

  if (result.error) return { ok: false, error: result.error.message };
  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim();
    const stdout = (result.stdout || "").trim();
    return { ok: false, error: stderr || stdout || `gh exited ${result.status}` };
  }
  return { ok: true };
}

async function askYesNo(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(question)).trim().toLowerCase();
    return answer === "" || answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}

export async function maybePromptGithubStar(deps: any = {}) {
  const stdinIsTTY = deps.stdinIsTTY ?? process.stdin.isTTY;
  const stdoutIsTTY = deps.stdoutIsTTY ?? process.stdout.isTTY;
  if (!stdinIsTTY || !stdoutIsTTY) return;

  const hasBeenPromptedImpl = deps.hasBeenPromptedFn ?? hasBeenPrompted;
  if (await hasBeenPromptedImpl()) return;

  const isGhInstalledImpl = deps.isGhInstalledFn ?? isGhInstalled;
  if (!isGhInstalledImpl()) return;

  const markPromptedImpl = deps.markPromptedFn ?? markPrompted;
  await markPromptedImpl();

  const askYesNoImpl = deps.askYesNoFn ?? askYesNo;
  const approved = await askYesNoImpl("[ima2] Enjoying ima2-gen? Star it on GitHub? [Y/n] ");
  if (!approved) return;

  const starRepoImpl = deps.starRepoFn ?? starRepo;
  const star = starRepoImpl();
  if (star.ok) {
    const log = deps.logFn ?? console.log;
    log("[ima2] Thanks for the star!");
    return;
  }

  const warn = deps.warnFn ?? console.warn;
  warn(`[ima2] Could not star repository automatically: ${star.error}`);
}
