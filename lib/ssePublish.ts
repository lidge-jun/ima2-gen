import { publish } from "./eventBus.js";
import { getJobPhase, isJobCanceled, isJobTrackingExpired } from "./inflight.js";
import { buildEnvelope } from "./jobs/envelope.js";

/**
 * Publish a multiplexed job event. Cancellation/expiry dominate later terminal
 * errors and success, so abort listeners cannot replace the established outcome.
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
  if ((event === "done" || event === "error") &&
      (isJobCanceled(requestId) || isJobTrackingExpired(requestId))) return false;
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
