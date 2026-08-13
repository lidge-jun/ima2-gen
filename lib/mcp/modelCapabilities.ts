// Normalized, secret-free model capability contract shared by MCP catalog and
// provider adapters. Provider output is untrusted: every public projection is
// bounded before it can reach the UI or an executable adapter.

export type McpPresetValue = string | number | boolean;
export type McpParameterType = "string" | "number" | "boolean" | "string_array";
export type McpCapabilitySource = "provider-declared" | "verified-contract";

export interface McpModelParameter {
  name: string;
  type: McpParameterType;
  required?: boolean | undefined;
  description?: string | undefined;
  default?: McpPresetValue | undefined;
  options?: McpPresetValue[] | undefined;
  min?: number | undefined;
  max?: number | undefined;
}

export interface McpModelCapabilities {
  source: McpCapabilitySource;
  aspectRatios: string[];
  parameters: McpModelParameter[];
  inputRoles: string[];
}

export interface McpModelEntry {
  id: string;
  label: string;
  description?: string | undefined;
  capabilities: McpModelCapabilities;
}

const PARAMETER_NAME = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const MAX_PRESET_KEYS = 24;
const MAX_PRESET_STRING = 128;

export function isMcpPresetValue(value: unknown): value is McpPresetValue {
  return typeof value === "boolean"
    || (typeof value === "number" && Number.isFinite(value))
    || (typeof value === "string" && value.length <= MAX_PRESET_STRING);
}

/** Browser payload boundary. Unknown keys are rejected by the provider adapter;
 * this helper only proves a small scalar record and rejects shape abuse early. */
export function parseMcpPresetRecord(value: unknown): Record<string, McpPresetValue> {
  if (value === undefined || value === null) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("INVALID_MCP_PARAMETERS");
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > MAX_PRESET_KEYS) throw new Error("INVALID_MCP_PARAMETERS");
  const parsed: Record<string, McpPresetValue> = {};
  for (const [name, candidate] of entries) {
    if (!PARAMETER_NAME.test(name) || !isMcpPresetValue(candidate)) {
      throw new Error("INVALID_MCP_PARAMETERS");
    }
    parsed[name] = candidate;
  }
  return parsed;
}

export function isParameterValueAllowed(parameter: McpModelParameter, value: McpPresetValue): boolean {
  if (parameter.type === "number" && typeof value !== "number") return false;
  if (parameter.type === "boolean" && typeof value !== "boolean") return false;
  if (parameter.type === "string" && typeof value !== "string") return false;
  if (parameter.type === "string_array") return false;
  if (parameter.options && !parameter.options.some((option) => option === value)) return false;
  if (typeof value === "number") {
    if (parameter.min !== undefined && value < parameter.min) return false;
    if (parameter.max !== undefined && value > parameter.max) return false;
  }
  return true;
}
