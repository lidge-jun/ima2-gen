// Availability state machine (WP2 / 020). Pure functions only.
// Interview-locked rules:
//  - a bundled/cached snapshot alone stays `documented` — never auto-promoted;
//  - `callable` requires: live session AND tool present in live tools/list AND schema hash match;
//  - live drift locks execution (`stale`); entitlement gaps are `blocked`, not drift.
import type { Availability, AvailabilityCause } from "./types.js";

export interface AvailabilityInput {
  /** A live authenticated MCP session exists for the provider. */
  connected: boolean;
  /** The tool name is present in the live tools/list result. */
  liveToolPresent: boolean;
  /** The live schema hash matches the stored snapshot hash. */
  schemaHashMatch: boolean;
  /** Local transport/package is installed (remote endpoints: treated as true when registered). */
  installed?: boolean | undefined;
  /** Typed denial observed from the provider (revoked grant, entitlement rejection...). */
  deniedCause?: AvailabilityCause | undefined;
}

export function isCallable(input: AvailabilityInput): boolean {
  return input.connected && input.liveToolPresent && input.schemaHashMatch && !input.deniedCause;
}

export function deriveAvailability(input: AvailabilityInput, evidence?: string): Availability {
  if (input.deniedCause) return { state: "blocked", cause: input.deniedCause, evidence };
  if (!input.connected) {
    return input.installed
      ? { state: "installed", cause: "auth_required", evidence }
      : { state: "documented", cause: "auth_required", evidence };
  }
  if (!input.liveToolPresent) return { state: "blocked", cause: "entitlement", evidence };
  if (!input.schemaHashMatch) return { state: "stale", cause: "schema_drift", evidence };
  return { state: "callable", evidence };
}

/** Map an availability to the typed error an execution attempt must return. */
export function executionDenialFor(availability: Availability): "auth_required" | "unavailable" | "schema_changed" | null {
  switch (availability.state) {
    case "callable":
      return null;
    case "stale":
      return "schema_changed";
    case "documented":
    case "installed":
      return "auth_required";
    case "connected":
      return "unavailable";
    case "blocked":
      return availability.cause === "auth_required" ? "auth_required" : "unavailable";
  }
}
