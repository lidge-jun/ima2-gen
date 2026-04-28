export type ReasoningEffort = "low" | "medium" | "high" | "xhigh";

export const DEFAULT_REASONING_EFFORT: ReasoningEffort = "medium";
export const REASONING_EFFORT_STORAGE_KEY = "ima2.reasoningEffort";

export const REASONING_EFFORT_OPTIONS: Array<{
  value: ReasoningEffort;
  shortLabel: string;
  fullLabelKey: string;
}> = [
  { value: "low", shortLabel: "low", fullLabelKey: "settings.reasoning.low" },
  { value: "medium", shortLabel: "med", fullLabelKey: "settings.reasoning.medium" },
  { value: "high", shortLabel: "high", fullLabelKey: "settings.reasoning.high" },
  { value: "xhigh", shortLabel: "xhigh", fullLabelKey: "settings.reasoning.xhigh" },
];

export function isReasoningEffort(value: unknown): value is ReasoningEffort {
  return REASONING_EFFORT_OPTIONS.some((option) => option.value === value);
}
