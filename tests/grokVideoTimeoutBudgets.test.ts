import test from "node:test";
import assert from "node:assert/strict";
import { config } from "../config.js";
import { videoConfig } from "../lib/grokVideoShared.ts";
import { getPlannerConfig } from "../lib/grokImageCore.ts";

// The 260817 planner-timeout incident was a planning phase that cost two independent
// budgets and clients that gave up before the server did. These assertions keep the
// timeout ladder coherent so it cannot silently regress.
// devlog/_plan/260817_grok_video_planner_timeout/010_timeout_budgets.md

const CLI_VIDEO_TIMEOUT_SEC = 4200;
const MCP_VIDEO_TIMEOUT_SEC = 4200;
const UI_JOB_STREAM_TIMEOUT_MS = 70 * 60 * 1000;

test("grok video stage budgets fit STRICTLY inside the planning ceiling", () => {
  const cfg = videoConfig({ config });
  // Strict inequality matters: if planTotal equals the sum, a slow search followed by a
  // stalled planner lands both timers together and the fatal phase ceiling wins the race,
  // so the local planner fallback never runs and the user still sees a timeout.
  assert.ok(
    cfg.searchTimeoutMs + cfg.plannerTimeoutMs < cfg.planTotalTimeoutMs,
    `search (${cfg.searchTimeoutMs}) + planner (${cfg.plannerTimeoutMs}) must fit strictly inside planTotal (${cfg.planTotalTimeoutMs})`,
  );
});

test("the search stage is bounded more tightly than the planner it precedes", () => {
  const cfg = videoConfig({ config });
  // The brief is degradable; the planner is the stage that must be allowed to be slow.
  assert.ok(cfg.searchTimeoutMs < cfg.plannerTimeoutMs);
});

test("planner budget is calibrated above the observed stall, not the idle probe", () => {
  const cfg = videoConfig({ config });
  // The reported failure stalled for the full 300 s budget; the replacement must clear it.
  assert.ok(cfg.plannerTimeoutMs >= 900_000, "planner budget must be at least 3x the 300 s stall");
});

test("the image lane inherits the same split planner/search budgets", () => {
  const planner = getPlannerConfig({ config });
  assert.equal(planner.timeoutMs, config.grokProvider.plannerTimeoutMs);
  assert.equal(planner.searchTimeoutMs, config.grokProvider.searchTimeoutMs);
  assert.ok(planner.searchTimeoutMs < planner.timeoutMs);
});

test("every client ceiling sits above the server worst case", () => {
  const cfg = videoConfig({ config });
  const serverWorstCaseMs = cfg.planTotalTimeoutMs
    + cfg.startTimeoutMs
    + cfg.totalTimeoutMs
    + config.grokProvider.videoDownloadTimeoutMs;

  // An equal ceiling is a race: each client must have real slack.
  assert.ok(CLI_VIDEO_TIMEOUT_SEC * 1000 > serverWorstCaseMs, "CLI --timeout default must exceed the server worst case");
  assert.ok(MCP_VIDEO_TIMEOUT_SEC * 1000 > serverWorstCaseMs, "MCP video ceiling must exceed the server worst case");
  assert.ok(UI_JOB_STREAM_TIMEOUT_MS > serverWorstCaseMs, "UI stream timeout must exceed the server worst case");
  assert.ok(config.inflight.ttlMs > serverWorstCaseMs, "inflight TTL must outlive the longest legal request");
});
