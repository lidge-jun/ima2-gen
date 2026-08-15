/**
 * Provider Adapter v1 (#150, phase 1).
 *
 * The capability registry answers who exists, what models they have, and what
 * limits apply. It is a control plane, not a plugin interface: runtime behavior
 * still lives in per-provider modules that routes reach into directly, so
 * adding a provider still touches core, routes, UI, and tests at once.
 *
 * This is the boundary that fixes that, starting with the parts a lane already
 * owns today: authentication state, its model list, and its own error
 * vocabulary. Generation and editing stay optional here because their signature
 * depends on the cancel/retry/resume contract that #151 has not fixed yet -
 * pinning them now would mean changing them twice.
 */
import type { JobHandle } from "../../jobs/envelope.js";
import type { CoreProviderId } from "../registry.js";
import type { CoreProviderModel } from "../types.js";

export interface AuthResult {
  ok: boolean;
  /** Why authentication is unavailable, in the wording the UI already shows. */
  reason?: string;
}

/**
 * A provider error in one shape, owned by the adapter that produced it.
 *
 * Today each lane's error codes are spread across the route that calls it. An
 * adapter that normalizes its own errors is what lets a shared contract suite
 * assert on them without knowing which provider it is testing.
 */
export interface ProviderError {
  code: string;
  message: string;
  status?: number;
  retryable?: boolean;
  providerState?: string;
}

export interface ProviderAdapterV1 {
  readonly laneId: CoreProviderId;
  /** Whether this lane can be used right now, read from the live runtime context. */
  validateAuth(): AuthResult;
  /** Derived from the registry, never hand-written. */
  listModels(): readonly CoreProviderModel[];
  normalizeError(error: unknown): ProviderError;
  generateImage?(input: unknown): Promise<JobHandle>;
  editImage?(input: unknown): Promise<JobHandle>;
}
