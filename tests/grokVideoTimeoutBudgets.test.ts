import test from "node:test";
import assert from "node:assert/strict";
import { config } from "../config.js";
import { videoConfig } from "../lib/grokVideoShared.ts";
import { getPlannerConfig } from "../lib/grokImageCore.ts";
import { VIDEO_CLIENT_TIMEOUT_MS, VIDEO_CLIENT_TIMEOUT_SEC } from "../lib/videoClientTimeouts.ts";
import { JOB_STREAM_TIMEOUT_MS } from "../ui/src/lib/eventChannel.ts";

// The 260817 planner-timeout incident was a planning phase that cost two independent
// budgets and clients that gave up before the server did. These assertions keep the
// timeout ladder coherent so it cannot silently regress.
// devlog/_plan/260817_grok_video_planner_timeout/010_timeout_budgets.md

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
  // The poll loop checks its deadline BEFORE each request, so the final poll can overshoot
  // the poll budget by one request timeout. Count that overshoot, or the ladder is only
  // correct on paper.
  const pollOvershootMs = cfg.startTimeoutMs;
  const serverWorstCaseMs = cfg.planTotalTimeoutMs
    + cfg.startTimeoutMs
    + cfg.totalTimeoutMs
    + pollOvershootMs
    + config.grokProvider.videoDownloadTimeoutMs;

  // An equal ceiling is a race: each client must have real slack.
  // These are imported from the real client modules, not restated here: a hardcoded copy
  // would keep passing after someone lowered an actual client default.
  assert.ok(VIDEO_CLIENT_TIMEOUT_SEC * 1000 > serverWorstCaseMs, "CLI --timeout default must exceed the server worst case");
  assert.ok(VIDEO_CLIENT_TIMEOUT_MS > serverWorstCaseMs, "MCP video ceiling must exceed the server worst case");
  assert.ok(JOB_STREAM_TIMEOUT_MS > serverWorstCaseMs, "UI stream timeout must exceed the server worst case");
  assert.ok(config.inflight.ttlMs > serverWorstCaseMs, "inflight TTL must outlive the longest legal request");
});

test("a misconfigured planning ceiling is clamped instead of preempting the fallback", () => {
  // An operator raising IMA2_GROK_PLANNER_TIMEOUT_MS past the ceiling would otherwise
  // restore the race the fix exists to close.
  const cfg = videoConfig({
    config: {
      ...config,
      grokProvider: { ...config.grokProvider, plannerTimeoutMs: 1_500_000, searchTimeoutMs: 300_000, videoPlanTotalTimeoutMs: 1_500_000 },
    },
  });
  assert.ok(cfg.planTotalTimeoutMs > cfg.searchTimeoutMs + cfg.plannerTimeoutMs);
});
