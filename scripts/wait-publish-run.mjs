#!/usr/bin/env node
/**
 * Waits for the publish.yml run that release.yml just dispatched.
 *
 * `gh workflow run` returns nothing identifying, so the run has to be found afterwards.
 * Matching is deliberately strict: only a workflow_dispatch run of publish.yml created
 * after this script started counts. Picking "the latest run" would happily adopt an
 * unrelated push run and report someone else's success as ours.
 *
 * Usage: node scripts/wait-publish-run.mjs <sha> [timeoutMinutes]
 */
import { execFileSync } from "node:child_process";

const POLL_MS = 15_000;
const DISCOVERY_TIMEOUT_MS = 3 * 60 * 1000;

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The run must be a dispatch of this workflow that started after we asked for it. */
export function pickRun(runs, startedAtMs) {
  return runs
    .filter((run) => run.event === "workflow_dispatch")
    .filter((run) => Date.parse(run.createdAt) >= startedAtMs)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))[0];
}

async function main() {
  const [sha, timeoutMinutes = "60"] = process.argv.slice(2);
  if (!sha) throw new Error("usage: wait-publish-run.mjs <sha> [timeoutMinutes]");
  // A dispatch is queued a moment before it becomes visible, so allow a small skew.
  const startedAtMs = Date.now() - 60_000;
  const deadline = Date.now() + Number(timeoutMinutes) * 60 * 1000;

  let run = null;
  while (!run) {
    if (Date.now() - startedAtMs > DISCOVERY_TIMEOUT_MS) {
      throw new Error("publish.yml run never appeared after the dispatch");
    }
    const runs = JSON.parse(gh(["run", "list", "--workflow", "publish.yml", "--limit", "20", "--json", "databaseId,event,createdAt,status,conclusion"]));
    run = pickRun(runs, startedAtMs);
    if (!run) await sleep(POLL_MS);
  }
  console.log(`[wait-publish] watching run ${run.databaseId} for ${sha}`);

  for (;;) {
    const current = JSON.parse(gh(["run", "view", String(run.databaseId), "--json", "status,conclusion"]));
    if (current.status === "completed") {
      if (current.conclusion !== "success") {
        throw new Error(`publish run ${run.databaseId} concluded ${current.conclusion}`);
      }
      console.log(`[wait-publish] run ${run.databaseId} succeeded`);
      return;
    }
    if (Date.now() > deadline) throw new Error(`publish run ${run.databaseId} did not finish within ${timeoutMinutes} minutes`);
    await sleep(POLL_MS);
  }
}

const isMain = process.argv[1] && process.argv[1].endsWith("wait-publish-run.mjs");
if (isMain) {
  main().catch((error) => {
    console.error(`[wait-publish] ${error.message}`);
    process.exit(1);
  });
}
