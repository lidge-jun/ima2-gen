#!/usr/bin/env node
/**
 * Waits for the publish.yml run that release.yml just dispatched.
 *
 * `gh workflow run` returns nothing identifying, so the run has to be found afterwards.
 * Matching must therefore be exact: the run has to be a workflow_dispatch of publish.yml,
 * created after we asked, AND carrying the same publish_ref/publish_sha inputs we sent.
 * Time alone is not enough — two overlapping releases, or a human dispatch, would let us
 * adopt someone else's run and report their success as this release's.
 *
 * Usage: node scripts/wait-publish-run.mjs <publishRef> <publishSha> [timeoutMinutes]
 */
import { execFileSync } from "node:child_process";

const POLL_MS = 15_000;
const DISCOVERY_TIMEOUT_MS = 3 * 60 * 1000;

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A candidate must match on event, time, AND the inputs we dispatched. `gh run list`
 * does not expose inputs, so the caller supplies them from `gh api` per candidate.
 */
export function matchesDispatch(run, { startedAtMs, publishRef, publishSha, inputsOf }) {
  if (run.event !== "workflow_dispatch") return false;
  if (!(Date.parse(run.createdAt) >= startedAtMs)) return false;
  const inputs = inputsOf(run);
  if (!inputs) return false;
  return inputs.publish_ref === publishRef && inputs.publish_sha === publishSha;
}

export function pickRun(runs, options) {
  return runs
    .filter((run) => matchesDispatch(run, options))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))[0];
}

/**
 * Reads the dispatch inputs recorded on the run. A run whose inputs cannot be read is
 * simply not a match — never a match by default.
 */
function dispatchInputs(run) {
  try {
    return JSON.parse(gh([
      "api",
      `repos/{owner}/{repo}/actions/runs/${run.databaseId}`,
      "--jq",
      "{publish_ref: .inputs.publish_ref, publish_sha: .inputs.publish_sha}",
    ]));
  } catch {
    return null;
  }
}

async function main() {
  const [publishRef, publishSha, timeoutMinutes = "60"] = process.argv.slice(2);
  if (!publishRef || !publishSha) throw new Error("usage: wait-publish-run.mjs <publishRef> <publishSha> [timeoutMinutes]");
  // A dispatch is queued a moment before it becomes visible, so allow a small skew.
  const startedAtMs = Date.now() - 60_000;
  const deadline = Date.now() + Number(timeoutMinutes) * 60 * 1000;

  let run = null;
  while (!run) {
    if (Date.now() - startedAtMs > DISCOVERY_TIMEOUT_MS) {
      throw new Error("publish.yml run never appeared after the dispatch");
    }
    const runs = JSON.parse(gh(["run", "list", "--workflow", "publish.yml", "--limit", "20", "--json", "databaseId,event,createdAt,status,conclusion"]));
    run = pickRun(runs, { startedAtMs, publishRef, publishSha, inputsOf: dispatchInputs });
    if (!run) await sleep(POLL_MS);
  }
  console.log(`[wait-publish] watching run ${run.databaseId} for ${publishRef}@${publishSha}`);

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
