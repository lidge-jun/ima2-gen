// Media job executor (050 WP5): tools/call + task polling. Pure execution —
// returns normalized results; persistence belongs to routes/mcpMedia.ts.
import type { McpConnectionManager } from "./connectionManager.js";
import type { MediaJobRequest, MediaProviderAdapter, MediaTaskPoll, ToolCallPlan } from "./providerAdapter.js";

export interface ExecuteMediaJobOptions {
  signal?: AbortSignal;
  /** Overall deadline. Defaults: image 5min, video 12min. */
  timeoutMs?: number;
  pollIntervalMs?: number;
  onPhase?: (phase: "provider-queued" | "provider-running") => void;
}

export interface MediaJobResult {
  taskId: string;
  outputUrls: string[];
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new Error("MCP_JOB_ABORTED")); }, { once: true });
  });

/** Provider-side rate limiting shows up as tool-error text, not HTTP status (020-A). */
const RATE_LIMIT_PATTERN = /\b429\b|rate.?limit|too many request/i;
function isRateLimited(error: unknown): boolean {
  return RATE_LIMIT_PATTERN.test(String((error as Error)?.message ?? error));
}

export async function executeMediaJob(
  manager: McpConnectionManager,
  adapter: MediaProviderAdapter,
  request: MediaJobRequest,
  options: ExecuteMediaJobOptions = {},
): Promise<MediaJobResult> {
  if (!adapter.executable) throw new Error(`MCP_EXECUTION_LOCKED:${adapter.provider}`);
  const plan = adapter.buildGenerateCall(request);
  const timeoutMs = options.timeoutMs ?? (request.kind === "video" ? 12 * 60_000 : 5 * 60_000);
  return executeMediaPlan(manager, adapter, plan, { ...options, timeoutMs });
}

/** Shared submit -> taskId -> poll path (060 WP6): used by generation AND media actions. */
export async function executeMediaPlan(
  manager: McpConnectionManager,
  adapter: MediaProviderAdapter,
  plan: ToolCallPlan,
  options: ExecuteMediaJobOptions = {},
): Promise<MediaJobResult> {
  if (!adapter.executable) throw new Error(`MCP_EXECUTION_LOCKED:${adapter.provider}`);
  const deadline = Date.now() + (options.timeoutMs ?? 12 * 60_000);
  const submitResult = await manager.callTool(adapter.provider, plan.toolName, plan.args, { ...(options.signal ? { signal: options.signal } : {}) });
  const taskId = adapter.parseTaskId(submitResult);
  if (!taskId) throw new Error(`MCP_TASK_ID_MISSING:${adapter.provider}:${plan.toolName}`);
  options.onPhase?.("provider-queued");

  // Official guidance: >=5s between task polls, with jitter (260718).
  let interval = options.pollIntervalMs ?? 5_000;
  let sawRunning = false;
  let pollErrors = 0;
  for (;;) {
    if (options.signal?.aborted) throw new Error("MCP_JOB_ABORTED");
    if (Date.now() > deadline) throw new Error(`MCP_JOB_TIMEOUT:${taskId}`);
    await sleep(interval + Math.floor(Math.random() * 1_000), options.signal);
    interval = Math.min(interval * 1.5, 15_000);
    const pollPlan = adapter.buildPollCall(taskId);
    let pollResult: Record<string, unknown>;
    try {
      pollResult = await manager.callTool(adapter.provider, pollPlan.toolName, pollPlan.args, { ...(options.signal ? { signal: options.signal } : {}) });
      pollErrors = 0;
    } catch (error) {
      if (options.signal?.aborted) throw new Error("MCP_JOB_ABORTED");
      // Rate limiting is not a poll failure: the remote task is still alive.
      // Back off harder and keep polling; the overall deadline bounds waiting.
      if (isRateLimited(error)) { interval = Math.min(interval * 2, 30_000); continue; }
      // A dropped poll must not kill a running remote task — retry up to 3.
      pollErrors += 1;
      if (pollErrors >= 3) throw error;
      continue;
    }
    const poll: MediaTaskPoll = adapter.parsePoll(pollResult);
    if (poll.status === "running" && !sawRunning) { sawRunning = true; options.onPhase?.("provider-running"); }
    if (poll.status === "succeeded") {
      if (poll.outputUrls.length === 0) throw new Error(`MCP_RESULT_URL_MISSING:${taskId}`);
      return { taskId, outputUrls: poll.outputUrls };
    }
    if (poll.status === "failed") throw new Error(`MCP_TASK_FAILED:${taskId}:${poll.detail ?? ""}`);
    if (poll.status === "canceled") throw new Error(`MCP_TASK_CANCELED:${taskId}`);
  }
}
