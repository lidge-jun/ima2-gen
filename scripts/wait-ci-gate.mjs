#!/usr/bin/env node
/**
 * Waits for the ci.yml run that release.yml dispatched for a release candidate.
 *
 * Correlation (roadmap 030, c4): the run must match BOTH
 *   - id above the pre-dispatch high-water mark (ids increase monotonically), and
 *   - headSha equal to the candidate's FULL 40-char SHA (abbreviated SHAs silently
 *     match nothing — that exact mistake produced "CI never runs on version commits"
 *     during roadmap research).
 * The candidate is dispatched with `--ref release-candidate`, so the run's headSha
 * IS the candidate SHA.
 *
 * Usage:
 *   node scripts/wait-ci-gate.mjs latest-id
 *   node scripts/wait-ci-gate.mjs wait <afterRunId> <candidateSha> [timeoutMinutes]
 */
import { execFileSync } from "node:child_process";

const POLL_MS = 15_000;
const DISCOVERY_TIMEOUT_MS = 3 * 60 * 1000;

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function assertFullSha(sha) {
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error(`ci gate requires the full 40-char SHA, got: ${sha}`);
  }
}

export function pickRun(runs, afterRunId, candidateSha) {
  assertFullSha(candidateSha);
  return runs
    .filter((run) => run.event === "workflow_dispatch")
    .filter((run) => Number(run.databaseId) > Number(afterRunId))
    .filter((run) => run.headSha === candidateSha)
    .sort((a, b) => Number(a.databaseId) - Number(b.databaseId))[0];
}

function listRuns() {
  return JSON.parse(
    gh([
      "run", "list", "--workflow", "ci.yml", "--branch", "release-candidate",
      "--limit", "20", "--json", "databaseId,event,headSha,createdAt,status,conclusion",
    ]),
  );
}

/**
 * A single `gh` call can fail on a transient api.github.com i/o timeout. That
 * once killed a release cut at minute 12 of an otherwise green candidate run:
 * the CI it was watching went on to pass, but the gate had already exited 1.
 *
 * Polling is idempotent, so a failed poll is not evidence about the run — only
 * about the network. Return null and let the caller poll again; the surrounding
 * deadline still bounds the wait, so a genuinely unreachable API times out
 * rather than looping forever.
 */
function listRunsOrNull() {
  try {
    return listRuns();
  } catch (error) {
    console.log(`ci gate: transient list failure, retrying — ${String(error.message || error).split("\n")[0]}`);
    return null;
  }
}

function latestId() {
  const runs = JSON.parse(
    gh(["run", "list", "--workflow", "ci.yml", "--limit", "5", "--json", "databaseId"]),
  );
  const newest = runs.map((run) => Number(run.databaseId)).sort((a, b) => b - a)[0];
  console.log(String(newest ?? 0));
}

async function waitFor(afterRunId, candidateSha, timeoutMinutes) {
  assertFullSha(candidateSha);
  if (!afterRunId) throw new Error("usage: wait-ci-gate.mjs wait <afterRunId> <candidateSha> [timeoutMinutes]");
  const discoveryDeadline = Date.now() + DISCOVERY_TIMEOUT_MS;
  const deadline = Date.now() + Number(timeoutMinutes) * 60 * 1000;

  let run = null;
  while (!run) {
    if (Date.now() > discoveryDeadline) {
      throw new Error(`no ci.yml run with headSha ${candidateSha} appeared above run id ${afterRunId}`);
    }
    const runs = listRunsOrNull();
    run = runs ? pickRun(runs, afterRunId, candidateSha) : null;
    if (!run) await sleep(POLL_MS);
  }
  console.log(`ci gate: watching run ${run.databaseId} (headSha ${run.headSha})`);

  while (run.status !== "completed") {
    if (Date.now() > deadline) throw new Error(`ci.yml run ${run.databaseId} did not finish in time`);
    await sleep(POLL_MS);
    const fresh = listRunsOrNull()?.find((candidate) => candidate.databaseId === run.databaseId);
    if (fresh) run = fresh;
  }
  if (run.conclusion !== "success") {
    throw new Error(`ci.yml run ${run.databaseId} concluded ${run.conclusion} for candidate ${candidateSha}`);
  }
  console.log(`ci gate: run ${run.databaseId} succeeded for ${candidateSha}`);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command === "latest-id") return latestId();
  if (command === "wait") return waitFor(rest[0], rest[1], Number(rest[2] ?? 45));
  throw new Error("usage: wait-ci-gate.mjs latest-id | wait <afterRunId> <candidateSha> [timeoutMinutes]");
}

const isMain = process.argv[1] && process.argv[1].endsWith("wait-ci-gate.mjs");
if (isMain) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
