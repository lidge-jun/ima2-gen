import { publish } from "./eventBus.js";
import { getJobPhase, isJobCanceled } from "./inflight.js";
import { buildEnvelope } from "./jobs/envelope.js";

/**
 * Publish a multiplexed job event. Suppresses terminal `done` after cancel so
 * clients never resolve success when abortJob already emitted `error`.
 *
 * Also attaches the canonical envelope (#151). The snapshot is taken here,
 * before the event is queued, so replay reproduces what was true at publish
 * time rather than re-deriving state that has since moved on.
 */
export function publishJobEvent(
  requestId: string,
  event: string,
  data: Record<string, unknown>,
): boolean {
  if (event === "done" && isJobCanceled(requestId)) return false;
  const inflightPhase = getJobPhase(requestId);
  publish(requestId, event, data, {
    buildEnvelope: (sequence) => buildEnvelope({
      jobId: requestId,
      requestId,
      sequence,
      event,
      data,
      inflightPhase,
    }),
  });
  return true;
}
