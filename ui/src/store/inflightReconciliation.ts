import type { AppState, PersistedInFlight, InflightQueryScope, ServerInFlightJob, ServerTerminalJob } from "./storeTypes";
import { getInflightQueryScopes, loadInFlight, matchesInflightScope, terminalJobError, toPersistedInFlightJob } from "./storeHelpers";

export interface InflightSnapshot {
  uiMode: AppState["uiMode"];
  activeSessionId: string | null;
  local: Map<string, PersistedInFlight>;
  revisions: Map<string, string>;
  memory: Map<string, PersistedInFlight>;
  scopes: InflightQueryScope[];
}
export interface InflightMerge {
  inFlight: PersistedInFlight[];
  terminalErrors: Array<Error & { code?: string; status?: number }>;
  eligibleIds: Set<string>;
  serverActiveIds: Set<string>;
}

function inflightRevision(job: PersistedInFlight): string {
  return JSON.stringify([job.startedAt, job.kind ?? "classic", job.sessionId ?? null,
    job.parentNodeId ?? null, job.clientNodeId ?? null, job.phase ?? null,
    job.prompt, job.composerPrompt ?? null, job.composerInsertedPrompts ?? null]);
}

export function captureInflightSnapshot(state: AppState): InflightSnapshot {
  const local = new Map([...loadInFlight({ includeExpired: true }), ...state.inFlight].map((job) => [job.id, job]));
  return {
    uiMode: state.uiMode, activeSessionId: state.activeSessionId ?? null, local,
    revisions: new Map([...local].map(([id, job]) => [id, inflightRevision(job)])),
    memory: new Map(state.inFlight.map((job) => [job.id, job])),
    scopes: getInflightQueryScopes({ uiMode: state.uiMode, activeSessionId: state.activeSessionId,
      inFlight: [...local.values()] }),
  };
}

export function isInflightSnapshotCurrent(snapshot: InflightSnapshot, state: AppState): boolean {
  return snapshot.uiMode === state.uiMode && snapshot.activeSessionId === (state.activeSessionId ?? null);
}

export function eligibleInflightIds(snapshot: InflightSnapshot, fresh: InflightSnapshot): Set<string> {
  return new Set([...fresh.local].filter(([id, job]) => {
    const replaced = snapshot.memory.has(id) && fresh.memory.has(id) && snapshot.memory.get(id) !== fresh.memory.get(id);
    return snapshot.local.has(id) && snapshot.revisions.get(id) === fresh.revisions.get(id)
      && !replaced && matchesInflightScope(job, snapshot.scopes);
  }).map(([id]) => id));
}

function mergeActive(local: PersistedInFlight, server: ServerInFlightJob, mode: "poll" | "reconcile"): PersistedInFlight {
  const restored = toPersistedInFlightJob(server);
  const next = mode === "reconcile"
    ? { ...local, ...restored, prompt: local.prompt || restored.prompt, phase: local.phase || restored.phase }
    : { ...local, phase: restored.phase, kind: restored.kind, sessionId: restored.sessionId,
      parentNodeId: restored.parentNodeId, clientNodeId: restored.clientNodeId };
  return inflightRevision(next) === inflightRevision(local) ? local : next;
}

function reconcileEntry(job: PersistedInFlight, server: ServerInFlightJob | undefined,
  terminal: ServerTerminalJob | undefined, snapshot: InflightSnapshot,
  context: { mode: "poll" | "reconcile"; now: number; terminalErrors: InflightMerge["terminalErrors"] }): PersistedInFlight[] {
  if (server && (context.mode === "reconcile" || !terminal)) {
    return [matchesInflightScope(toPersistedInFlightJob(server), snapshot.scopes)
      ? mergeActive(job, server, context.mode) : job];
  }
  if (terminal) {
    if (!matchesInflightScope(toPersistedInFlightJob(terminal), snapshot.scopes)) return [job];
    if (terminal.status === "error") context.terminalErrors.push(terminalJobError(terminal));
    return [];
  }
  const age = context.now - job.startedAt;
  return (context.mode === "poll" ? age <= 5000 : age < 10_000) ? [job] : [];
}

export function mergeInflightSnapshot(snapshot: InflightSnapshot, current: AppState,
  response: { jobs: ServerInFlightJob[]; terminalJobs: ServerTerminalJob[] },
  options: { mode: "poll" | "reconcile"; now: number }): InflightMerge | null {
  if (!isInflightSnapshotCurrent(snapshot, current)) return null;
  const fresh = captureInflightSnapshot(current);
  const eligibleIds = eligibleInflightIds(snapshot, fresh);
  const server = new Map(response.jobs.map((job) => [job.requestId, job]));
  const terminals = new Map(response.terminalJobs.map((job) => [job.requestId, job]));
  const terminalErrors: InflightMerge["terminalErrors"] = [];
  const inFlight = [...fresh.local.values()].flatMap((job) => eligibleIds.has(job.id)
    ? reconcileEntry(job, server.get(job.id), terminals.get(job.id), snapshot, { ...options, terminalErrors }) : [job]);
  const serverActiveIds = new Set<string>();
  for (const [id, job] of server) {
    const restored = toPersistedInFlightJob(job);
    if (!matchesInflightScope(restored, snapshot.scopes)) continue;
    serverActiveIds.add(id);
    // Supplemental scopes reconcile known jobs without expanding server-only discovery.
    if ((restored.kind ?? "classic") === "classic" && snapshot.uiMode === "node") continue;
    if (restored.kind === "node" && (snapshot.uiMode !== "node"
      || (restored.sessionId ?? null) !== snapshot.activeSessionId)) continue;
    if (!snapshot.local.has(id) && !fresh.local.has(id)) inFlight.push(restored);
  }
  return { inFlight, terminalErrors, eligibleIds, serverActiveIds };
}
