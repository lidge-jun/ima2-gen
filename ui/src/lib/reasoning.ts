export type ReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh" | "max";

export const DEFAULT_REASONING_EFFORT: ReasoningEffort = "max";
export const REASONING_EFFORT_STORAGE_KEY = "ima2.reasoningEffort";

export const REASONING_EFFORT_OPTIONS: Array<{
  value: ReasoningEffort;
  shortLabel: string;
  fullLabelKey: string;
}> = [
  { value: "none", shortLabel: "off", fullLabelKey: "settings.reasoning.none" },
  { value: "low", shortLabel: "low", fullLabelKey: "settings.reasoning.low" },
  { value: "medium", shortLabel: "med", fullLabelKey: "settings.reasoning.medium" },
  { value: "high", shortLabel: "high", fullLabelKey: "settings.reasoning.high" },
  { value: "xhigh", shortLabel: "xhigh", fullLabelKey: "settings.reasoning.xhigh" },
  { value: "max", shortLabel: "max", fullLabelKey: "settings.reasoning.max" },
];

export function isReasoningEffort(value: unknown): value is ReasoningEffort {
  return REASONING_EFFORT_OPTIONS.some((option) => option.value === value);
}

// Compact single-char labels for the result metadata bar.
// NOTE: deliberately NOT REASONING_EFFORT_OPTIONS.shortLabel (off/low/med/high/xhigh) —
// those are multi-char dropdown labels and "med" collides with quality "m".
// The "R:" prefix disambiguates reasoning from quality (which already renders l/m/h).
const REASONING_SHORT: Record<Exclude<ReasoningEffort, "none">, string> = {
  low: "l",
  medium: "m",
  high: "h",
  xhigh: "x",
  max: "M",
};

export function formatReasoningLabel(
  effort: ReasoningEffort | undefined | null,
): string | null {
  // Guard with isReasoningEffort so a non-canonical persisted string can never
  // produce "R:undefined" (it just hides, like "none").
  if (!isReasoningEffort(effort) || effort === "none") return null;
  return `R:${REASONING_SHORT[effort]}`;
}
