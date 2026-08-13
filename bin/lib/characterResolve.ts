// wp4 046: CLI-side character element resolution + binding precheck.
// Prechecks are UX hints only — the server response is the final authority
// (041/046 server-authority clause); server error codes pass through unchanged.

export type CharacterElementRecord = {
  id: string;
  name: string;
  metadata: Record<string, unknown> | null;
};

export type CharacterResolution =
  | { status: "ok"; element: CharacterElementRecord }
  | { status: "not_found" }
  | { status: "ambiguous"; matches: Array<{ id: string; name: string }> };

export async function resolveCharacterElement(serverBase: string, idOrName: string): Promise<CharacterResolution> {
  const base = serverBase.replace(/\/$/, "");
  const response = await fetch(`${base}/api/assets?kind=element&limit=500`);
  if (!response.ok) throw new Error(`failed to list elements: HTTP ${response.status}`);
  const payload = await response.json() as { assets?: Array<Record<string, unknown>> };
  const characters = (payload.assets ?? []).filter((asset) =>
    (asset.metadata as { elementKind?: unknown } | null)?.elementKind === "character");
  const byId = characters.filter((asset) => asset.id === idOrName);
  const candidates = byId.length > 0
    ? byId
    : characters.filter((asset) => asset.name === idOrName);
  if (candidates.length === 0) return { status: "not_found" };
  if (candidates.length > 1) {
    return {
      status: "ambiguous",
      matches: candidates.map((asset) => ({ id: String(asset.id), name: String(asset.name ?? "") })),
    };
  }
  const element = candidates[0];
  if (!element) return { status: "not_found" };
  return {
    status: "ok",
    element: {
      id: String(element.id),
      name: String(element.name ?? ""),
      metadata: (element.metadata as Record<string, unknown> | null) ?? null,
    },
  };
}

export type CharacterPrecheckError = { code: string; message: string };

import { fail } from "./output.js";

/** Returns the first failing precheck, or null when the binding looks usable.
 *  Mirrors the server gates in lib/mcp/characterRefs.ts — keep codes identical. */
export function precheckCharacterBinding(
  element: CharacterElementRecord,
  lane: string,
  inputRoles: readonly string[],
): CharacterPrecheckError | null {
  if (!inputRoles.includes("image_references")) {
    return {
      code: "CAPABILITY_MISMATCH",
      message: `${lane} model does not declare image_references; choose a model that does`,
    };
  }
  const bindings = Array.isArray(element.metadata?.characterBindings)
    ? element.metadata.characterBindings as Array<Record<string, unknown>>
    : [];
  const binding = bindings.find((entry) => entry.provider === lane);
  if (!binding) {
    return {
      code: "CHARACTER_BINDING_MISSING",
      message: `no ${lane} binding on character '${element.name}'; add one in the assets workspace`,
    };
  }
  if (binding.mode === "trained-id" && (binding.status === "training" || binding.status === "failed")) {
    return {
      code: "BINDING_NOT_READY",
      message: `character binding is ${String(binding.status)}; wait for training or retrain`,
    };
  }
  return null;
}

/** Resolve + precheck for the MCP lanes; exits via the CLI envelope on any
 *  failure (fail-closed, exit 2). Returns the element id ready for the request
 *  body. Server gates re-check everything — this is the fast UX path. */
export async function characterElementIdForMcp(args: {
  serverBase: string;
  idOrName: string;
  lane: string;
  inputRoles: readonly string[];
  json: boolean;
}): Promise<string> {
  const resolution = await resolveCharacterElement(args.serverBase, args.idOrName);
  if (resolution.status === "not_found") {
    fail({ json: args.json, code: "CHARACTER_ELEMENT_NOT_FOUND",
      message: `no character element matches '${args.idOrName}'`, exitCode: 2 });
  }
  if (resolution.status === "ambiguous") {
    fail({ json: args.json, code: "CHARACTER_ELEMENT_AMBIGUOUS",
      message: `multiple character elements named '${args.idOrName}'; use the element id`,
      extra: { matches: resolution.matches }, exitCode: 2 });
  }
  const problem = precheckCharacterBinding(resolution.element, args.lane, args.inputRoles);
  if (problem) fail({ json: args.json, code: problem.code, message: problem.message, exitCode: 2 });
  return resolution.element.id;
}
