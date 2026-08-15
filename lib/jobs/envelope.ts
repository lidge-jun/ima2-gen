/**
 * Canonical job envelope (#151, phase 1).
 *
 * Every generation path in this repo reports progress with its own vocabulary:
 * `streaming` from the classic pipeline, `provider-poll` from MCP recovery,
 * `extracting-frame` from video extension. Consumers that want to ask whether a
 * job is still running have to know all of them. The envelope answers that in
 * one shape while keeping the provider's own word in `providerState`, so
 * nothing is lost in translation.
 *
 * Phase 1 scope: the type, the phase mapping, and a per-job sequence. Stale
 * detection and the cancel/retry/resume contract are deliberately out; see
 * devlog/_plan/260815_open_issues_platform/030_wp3_envelope_phase1.md.
 */

export const JOB_PHASES = [
  "validating",
  "queued",
  "running",
  "post_processing",
  "completed",
  "failed",
  "cancelled",
  "timed_out",
] as const;

export type JobPhase = (typeof JOB_PHASES)[number];

const TERMINAL_PHASES = new Set<JobPhase>(["completed", "failed", "cancelled", "timed_out"]);

export function isTerminalPhase(phase: JobPhase): boolean {
  return TERMINAL_PHASES.has(phase);
}

export interface JobEnvelopeError {
  code: string;
  message: string;
  status?: number;
}

export interface JobEnvelopeV1 {
  version: 1;
  jobId: string;
  requestId: string;
  sequence: number;
  phase: JobPhase;
  terminal: boolean;
  progress?: number;
  retryable?: boolean;
  providerState?: string;
  error?: JobEnvelopeError;
}

/** A handle to a running job, used by the provider adapter interface (#150). */
export interface JobHandle {
  jobId: string;
  requestId: string;
  envelope: JobEnvelopeV1;
}

/**
 * Raw phase strings observed across the codebase, mapped to canonical phases.
 *
 * Collected by searching three ways, because a literal grep of setJobPhase
 * misses two thirds of them: `extracting-frame` and `persisting` arrive through
 * a stage variable (routes/videoExtended.ts:325,353), the Grok video phases
 * come from a type union (lib/grokVideoShared.ts:20), and `provider-queued`
 * travels through an onPhase callback (lib/mcp/executeMediaJob.ts:11).
 *
 * A value absent here still works: it maps to `running` and keeps its original
 * text in `providerState`. The table exists so the common cases carry accurate
 * meaning, not so the fallback never fires.
 */
export const RAW_PHASE_MAP: Readonly<Record<string, JobPhase>> = Object.freeze({
  queued: "queued",
  "provider-queued": "queued",
  validating: "validating",
  planning: "validating",
  preparing: "validating",
  streaming: "running",
  partial: "running",
  uploading: "running",
  "provider-running": "running",
  "provider-poll": "running",
  polling: "running",
  progress: "running",
  submitted: "running",
  decoding: "post_processing",
  downloading: "post_processing",
  "media-processing": "post_processing",
  "extracting-frame": "post_processing",
  persisting: "post_processing",
});

/** Phases whose canonical form already says everything the raw string did. */
const SELF_EVIDENT_PHASES = new Set(["queued", "validating", "streaming", "decoding"]);

export function toCanonicalPhase(raw: string | null | undefined): JobPhase {
  if (!raw) return "running";
  return RAW_PHASE_MAP[raw] ?? "running";
}

/** Keeps the provider's own word unless the canonical phase already is it. */
export function toProviderState(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  return SELF_EVIDENT_PHASES.has(raw) ? undefined : raw;
}

export interface BuildEnvelopeInput {
  jobId: string;
  requestId?: string | null | undefined;
  sequence: number;
  /** The SSE event name, which outranks any reported phase for terminal state. */
  event: string;
  /** The event payload, consulted for a self-reported phase. */
  data?: Record<string, unknown> | undefined;
  /** The inflight row's phase, used only when the event says nothing. */
  inflightPhase?: string | null | undefined;
}

function errorFromData(data: Record<string, unknown> | undefined): JobEnvelopeError | undefined {
  if (!data) return undefined;
  const code = typeof data.code === "string" ? data.code : undefined;
  const message = typeof data.error === "string"
    ? data.error
    : typeof data.message === "string" ? data.message : undefined;
  if (!code && !message) return undefined;
  const status = typeof data.status === "number" ? data.status : undefined;
  return {
    code: code ?? "UNKNOWN",
    message: message ?? "",
    ...(status === undefined ? {} : { status }),
  };
}

/**
 * Resolves the phase from the most informed source available.
 *
 * Order matters and was set by audit: several MCP routes publish `submitted`
 * right after startJob without calling setJobPhase, so the inflight row still
 * reads `queued` (routes/mcpMultishot.ts:67-80, routes/mcpMedia.ts:193).
 * Trusting inflight first would stamp those events with a phase the publisher
 * already knew was wrong, and the snapshot is immutable, so replay would repeat
 * that mistake forever.
 */
function resolvePhase(input: BuildEnvelopeInput): { phase: JobPhase; raw?: string } {
  if (input.event === "done") return { phase: "completed" };
  if (input.event === "error") {
    const code = typeof input.data?.code === "string" ? input.data.code : "";
    if (code === "GENERATION_CANCELED") return { phase: "cancelled" };
    if (/TIMEOUT|TIMED_OUT|DEADLINE/i.test(code)) return { phase: "timed_out" };
    return { phase: "failed" };
  }
  const reported = typeof input.data?.phase === "string" ? input.data.phase : undefined;
  if (reported) return { phase: toCanonicalPhase(reported), raw: reported };
  const inflight = input.inflightPhase ?? undefined;
  if (inflight) return { phase: toCanonicalPhase(inflight), raw: inflight };
  return { phase: "running" };
}

export function buildEnvelope(input: BuildEnvelopeInput): JobEnvelopeV1 {
  const { phase, raw } = resolvePhase(input);
  const providerState = toProviderState(raw);
  const progress = typeof input.data?.percent === "number"
    ? input.data.percent
    : typeof input.data?.progress === "number" ? input.data.progress : undefined;
  const error = phase === "failed" || phase === "cancelled" || phase === "timed_out"
    ? errorFromData(input.data)
    : undefined;
  return {
    version: 1,
    jobId: input.jobId,
    requestId: input.requestId || input.jobId,
    sequence: input.sequence,
    phase,
    terminal: isTerminalPhase(phase),
    ...(progress === undefined ? {} : { progress }),
    ...(providerState === undefined ? {} : { providerState }),
    ...(error === undefined ? {} : { error }),
  };
}
