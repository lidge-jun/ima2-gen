import { ulid } from "ulid";
import { getDb } from "./db.js";
import {
  type AgentGenerationErrorRecord,
  type AgentGenerationPlan,
  type AgentGenerationSettings,
  type AgentQueueItem,
  type AgentQueueStatus,
  type AgentSlashCommand,
  type AgentSessionRunSummary,
} from "./agentTypes.js";
import { DEFAULT_AGENT_GENERATION_SETTINGS, normalizeAgentGenerationSettings } from "./agentSettings.js";
import { normalizeAgentGenerationPlan } from "./agentGenerationPlanner.js";

type AgentQueueRow = {
  id: string;
  sessionId: string;
  requestId: string;
  prompt: string;
  options: string;
  toolPlan: string;
  status: AgentQueueStatus;
  position: number;
  resultImageIds: string;
  errorCode: string | null;
  errorClass: string | null;
  errorMessage: string | null;
  progressStage: AgentQueueItem["progressStage"];
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
};

export type AgentQueueProjection = {
  queueBySession: Record<string, AgentQueueItem[]>;
  runSummaryBySession: Record<string, AgentSessionRunSummary>;
};

export type AgentQueueLimits = {
  maxGlobalRunning: number;
  maxSessionRunning: number;
};

export function createAgentQueueItem(input: {
  sessionId: string;
  prompt: string;
  options?: unknown;
  plan?: unknown;
  command?: AgentSlashCommand | null;
}) {
  const t = Date.now();
  const id = `aq_${ulid()}`;
  const requestId = `agent_queue_${ulid()}`;
  const options = normalizeAgentGenerationSettings(input.options);
  const plan = input.plan
    ? normalizeAgentGenerationPlan(input.prompt, input.plan, options)
    : normalizeAgentGenerationPlan(input.prompt, { command: input.command }, options);
  const position = getQueuedCount(input.sessionId) + 1;
  getDb().prepare(`
    INSERT INTO agent_queue_items
      (id, session_id, request_id, prompt, options, tool_plan, status, position, result_image_ids, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'queued', ?, '[]', ?)
  `).run(id, input.sessionId, requestId, input.prompt, JSON.stringify(options), JSON.stringify(plan), position, t);
  return getAgentQueueItem(id)!;
}

export function getAgentQueueItem(id: string) {
  const row = getDb().prepare(`
    SELECT
      id,
      session_id AS sessionId,
      request_id AS requestId,
      prompt,
      options,
      tool_plan AS toolPlan,
      status,
      position,
      result_image_ids AS resultImageIds,
      error_code AS errorCode,
      error_class AS errorClass,
      error_message AS errorMessage,
      progress_stage AS progressStage,
      created_at AS createdAt,
      started_at AS startedAt,
      finished_at AS finishedAt
    FROM agent_queue_items
    WHERE id = ?
  `).get(id) as AgentQueueRow | undefined;
  return row ? queueItemFromRow(row) : null;
}

export function listAgentQueueItems(sessionId?: string | null) {
  const where = sessionId ? "WHERE session_id = ?" : "";
  const rows = getDb().prepare(`
    SELECT
      id,
      session_id AS sessionId,
      request_id AS requestId,
      prompt,
      options,
      tool_plan AS toolPlan,
      status,
      position,
      result_image_ids AS resultImageIds,
      error_code AS errorCode,
      error_class AS errorClass,
      error_message AS errorMessage,
      progress_stage AS progressStage,
      created_at AS createdAt,
      started_at AS startedAt,
      finished_at AS finishedAt
    FROM agent_queue_items
    ${where}
    ORDER BY
      CASE status WHEN 'running' THEN 0 WHEN 'queued' THEN 1 WHEN 'failed' THEN 2 ELSE 3 END,
      created_at DESC
    LIMIT 80
  `).all(...(sessionId ? [sessionId] : [])) as AgentQueueRow[];
  return rows.map(queueItemFromRow);
}

export function getAgentQueueProjection(sessionIds: readonly string[]): AgentQueueProjection {
  const queueBySession: Record<string, AgentQueueItem[]> = {};
  const runSummaryBySession: Record<string, AgentSessionRunSummary> = {};
  for (const sessionId of sessionIds) {
    const items = listAgentQueueItems(sessionId);
    queueBySession[sessionId] = items;
    runSummaryBySession[sessionId] = summarizeQueue(items);
  }
  return { queueBySession, runSummaryBySession };
}

export function claimNextAgentQueueItem(limits: AgentQueueLimits) {
  if (countRunningItems() >= limits.maxGlobalRunning) return null;
  const rows = getDb().prepare(`
    SELECT
      id,
      session_id AS sessionId,
      request_id AS requestId,
      prompt,
      options,
      tool_plan AS toolPlan,
      status,
      position,
      result_image_ids AS resultImageIds,
      error_code AS errorCode,
      error_class AS errorClass,
      error_message AS errorMessage,
      progress_stage AS progressStage,
      created_at AS createdAt,
      started_at AS startedAt,
      finished_at AS finishedAt
    FROM agent_queue_items
    WHERE status = 'queued'
    ORDER BY created_at ASC
    LIMIT 20
  `).all() as AgentQueueRow[];

  for (const row of rows) {
    if (countRunningItems(row.sessionId) >= limits.maxSessionRunning) continue;
    const res = getDb().prepare(`
      UPDATE agent_queue_items
      SET status = 'running', started_at = ?, progress_stage = NULL, error_code = NULL, error_class = NULL, error_message = NULL
      WHERE id = ? AND status = 'queued'
    `).run(Date.now(), row.id);
    if (res.changes > 0) return getAgentQueueItem(row.id);
  }
  return null;
}

export function completeAgentQueueItem(id: string, imageIds: readonly string[]) {
  getDb().prepare(`
    UPDATE agent_queue_items
    SET status = 'succeeded',
        result_image_ids = ?,
        finished_at = ?,
        progress_stage = NULL,
        error_code = NULL,
        error_class = NULL,
        error_message = NULL
    WHERE id = ? AND status = 'running'
  `).run(JSON.stringify([...imageIds]), Date.now(), id);
}

export function failAgentQueueItem(id: string, error: { code?: string | null; errorClass?: string | null; message: string }) {
  getDb().prepare(`
    UPDATE agent_queue_items
    SET status = 'failed',
        error_code = ?,
        error_class = ?,
        error_message = ?,
        finished_at = ?,
        progress_stage = NULL
    WHERE id = ? AND status = 'running'
  `).run(error.code ?? "AGENT_QUEUE_FAILED", error.errorClass ?? null, error.message, Date.now(), id);
}

export function cancelAgentQueueItem(id: string, reason = "Canceled by user") {
  const res = getDb().prepare(`
    UPDATE agent_queue_items
    SET status = 'canceled', error_code = 'canceled', error_class = NULL, error_message = ?, finished_at = ?, progress_stage = NULL
    WHERE id = ? AND status IN ('queued', 'running')
  `).run(reason, Date.now(), id);
  return res.changes > 0;
}

export function updateAgentQueueItemProgress(id: string, stage: AgentQueueItem["progressStage"]) {
  const res = getDb().prepare(`
    UPDATE agent_queue_items SET progress_stage = ?
    WHERE id = ? AND status = 'running'
  `).run(stage ?? null, id);
  return res.changes > 0;
}

export function recoverRunningAgentQueueItems() {
  const res = getDb().prepare(`
    UPDATE agent_queue_items
    SET status = 'failed', error_code = 'server_restart', error_class = NULL, error_message = 'server restarted mid-run',
        finished_at = ?, progress_stage = NULL
    WHERE status = 'running'
  `).run(Date.now());
  return res.changes;
}

export function updateAgentQueueItemPlan(id: string, plan: AgentGenerationPlan) {
  const res = getDb().prepare(`
    UPDATE agent_queue_items
    SET tool_plan = ?
    WHERE id = ?
  `).run(JSON.stringify(plan), id);
  return res.changes > 0;
}

export function getAgentGenerationErrors(sessionId: string, limit = 10): AgentGenerationErrorRecord[] {
  const cap = Math.max(1, Math.min(20, Math.round(limit)));
  const queueRows = getDb().prepare(`
    SELECT error_code AS code, error_class AS errorClass, error_message AS message, prompt, finished_at AS at
    FROM agent_queue_items
    WHERE session_id = ? AND status = 'failed'
    ORDER BY finished_at DESC
    LIMIT ?
  `).all(sessionId, cap) as Array<{ code: string | null; errorClass: string | null; message: string | null; prompt: string; at: number | null }>;
  const turnRows = getDb().prepare(`
    SELECT text, created_at AS at
    FROM agent_turns
    WHERE session_id = ? AND status = 'error'
    ORDER BY created_at DESC
    LIMIT ?
  `).all(sessionId, cap) as Array<{ text: string; at: number }>;
  const records: AgentGenerationErrorRecord[] = [
    ...queueRows.map((row) => ({
      scope: "queue" as const,
      code: row.code,
      ...(row.errorClass ? { errorClass: row.errorClass } : {}),
      message: row.message ?? "Generation failed without a recorded message.",
      prompt: row.prompt,
      at: row.at ?? 0,
    })),
    ...turnRows.map((row) => ({
      scope: "turn" as const,
      code: null,
      message: row.text,
      prompt: null,
      at: row.at,
    })),
  ];
  return records.sort((a, b) => b.at - a.at).slice(0, cap);
}

export function retryAgentQueueItem(id: string) {
  const res = getDb().prepare(`
    UPDATE agent_queue_items
    SET status = 'queued',
        position = ?,
        result_image_ids = '[]',
        error_code = NULL,
        error_class = NULL,
        error_message = NULL,
        progress_stage = NULL,
        started_at = NULL,
        finished_at = NULL
    WHERE id = ? AND status IN ('failed', 'canceled')
  `).run(getQueuedCount(null) + 1, id);
  return res.changes > 0;
}

function queueItemFromRow(row: AgentQueueRow): AgentQueueItem {
  const options = normalizeAgentGenerationSettings(parseJson(row.options, {}));
  return {
    id: row.id,
    sessionId: row.sessionId,
    requestId: row.requestId,
    prompt: row.prompt,
    status: row.status,
    position: row.position,
    resultImageIds: parseStringArray(row.resultImageIds),
    errorCode: row.errorCode,
    errorClass: row.errorClass,
    errorMessage: row.errorMessage,
    progressStage: row.progressStage ?? null,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    options,
    plan: normalizeAgentGenerationPlan(row.prompt, parseJson(row.toolPlan, {}), options),
  };
}

export function summarizeQueue(items: readonly AgentQueueItem[]): AgentSessionRunSummary {
  const queuedCount = items.filter((item) => item.status === "queued").length;
  const runningCount = items.filter((item) => item.status === "running").length;
  const latestTerminal = items
    .filter((item) => ["succeeded", "failed", "canceled"].includes(item.status))
    .sort((a, b) => (b.finishedAt ?? b.createdAt) - (a.finishedAt ?? a.createdAt))[0];
  const failed = latestTerminal?.status === "failed" ? latestTerminal : null;
  return {
    status: runningCount > 0 ? "running" : queuedCount > 0 ? "queued" : failed ? "error" : "idle",
    queuedCount,
    runningCount,
    lastQueueItemId: items[0]?.id ?? null,
    lastError: failed?.errorMessage ?? null,
  };
}

function getQueuedCount(sessionId: string | null) {
  const row = sessionId
    ? getDb().prepare("SELECT COUNT(*) AS count FROM agent_queue_items WHERE session_id = ? AND status = 'queued'").get(sessionId)
    : getDb().prepare("SELECT COUNT(*) AS count FROM agent_queue_items WHERE status = 'queued'").get();
  return Number((row as { count?: number } | undefined)?.count ?? 0);
}

function countRunningItems(sessionId?: string) {
  const row = sessionId
    ? getDb().prepare("SELECT COUNT(*) AS count FROM agent_queue_items WHERE session_id = ? AND status = 'running'").get(sessionId)
    : getDb().prepare("SELECT COUNT(*) AS count FROM agent_queue_items WHERE status = 'running'").get();
  return Number((row as { count?: number } | undefined)?.count ?? 0);
}

function parseJson(value: string, fallback: unknown) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseStringArray(value: string) {
  const parsed = parseJson(value, []);
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
}

export function getDefaultAgentQueueOptions(): AgentGenerationSettings {
  return DEFAULT_AGENT_GENERATION_SETTINGS;
}
