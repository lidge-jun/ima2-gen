import type { Quality } from "../types";

// Rough cost-per-image for gpt-image-2 sizes (preset-based estimate).
// Size auto/custom fall back to the nearest keyed size or 1024².
export const COST_MAP: Record<Quality, Record<string, number>> = {
  low: {
    "1024x1024": 0.006,
    "1024x1536": 0.005,
    "1536x1024": 0.005,
    "1024x1360": 0.005,
    "1360x1024": 0.005,
    "1024x1824": 0.006,
    "1824x1024": 0.006,
    "2048x2048": 0.012,
    "2048x1152": 0.009,
    "1152x2048": 0.009,
    "3824x2160": 0.023,
    "2160x3824": 0.023,
    auto: 0.006,
  },
  medium: {
    "1024x1024": 0.053,
    "1024x1536": 0.041,
    "1536x1024": 0.041,
    "1024x1360": 0.041,
    "1360x1024": 0.041,
    "1024x1824": 0.05,
    "1824x1024": 0.05,
    "2048x2048": 0.106,
    "2048x1152": 0.08,
    "1152x2048": 0.08,
    "3824x2160": 0.2,
    "2160x3824": 0.2,
    auto: 0.053,
  },
  high: {
    "1024x1024": 0.211,
    "1024x1536": 0.165,
    "1536x1024": 0.165,
    "1024x1360": 0.165,
    "1360x1024": 0.165,
    "1024x1824": 0.2,
    "1824x1024": 0.2,
    "2048x2048": 0.422,
    "2048x1152": 0.32,
    "1152x2048": 0.32,
    "3824x2160": 0.8,
    "2160x3824": 0.8,
    auto: 0.211,
  },
};

export function estimateCost(quality: Quality, size: string): number {
  return COST_MAP[quality]?.[size] ?? 0;
}
