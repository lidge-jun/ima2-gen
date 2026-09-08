export const IMAGE_MODEL_ALIASES = {
  astra: "gpt-6-astra",
  luna: "gpt-5.6-luna",
  sol: "gpt-5.6-sol",
  terra: "gpt-5.6-terra",
  spark: "gpt-5.3-codex-spark",
} as const;

export function canonicalizeImageModel(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const model = String(value);
  return IMAGE_MODEL_ALIASES[model as keyof typeof IMAGE_MODEL_ALIASES] || model;
}
