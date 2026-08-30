import type { AgentToolCallSummary, AgentToolName, AgentTurn } from "../components/agent/agentTypes";

const TOOL_NAMES: AgentToolName[] = [
  "ima2.get_image_context",
  "ima2.web_search",
  "ima2.generate_image",
  "ima2.generate_video",
  "ima2.get_generation_errors",
];

export function formatAgentToolLabel(text: string): string {
  return text.replace(/\s+/g, " ").trim() || "tool";
}

export function getAgentToolCalls(turn: AgentTurn): AgentToolCallSummary[] {
  if (turn.toolCalls?.length) return turn.toolCalls;
  const text = formatAgentToolLabel(turn.text);
  return TOOL_NAMES
    .filter((name) => text.includes(name))
    .map((name, index) => ({
      id: `${turn.id}-fallback-${index}`,
      name,
      status: turn.status === "error" ? "error" : turn.status === "streaming" ? "running" : "complete",
      outputSummary: text,
      imageIds: name === "ima2.generate_image" || name === "ima2.generate_video" ? turn.imageIds ?? [] : [],
      webFindingIds: name === "ima2.web_search" ? turn.webFindingIds ?? [] : [],
    }));
}

export function formatDuration(durationMs?: number | null): string | null {
  if (!durationMs || durationMs < 0) return null;
  if (durationMs < 1_000) return `${durationMs}ms`;
  return `${(durationMs / 1_000).toFixed(1)}s`;
}

// Tool rows are the transcript's audit handle: the collapsed line must say what
// the tool did and to what, so the payload only matters when debugging. Raw
// identifiers like "ima2.generate_image" satisfy neither reading.
const TOOL_LABEL_KEYS: Record<string, string> = {
  "ima2.get_image_context": "agent.toolLabel.getImageContext",
  "ima2.web_search": "agent.toolLabel.webSearch",
  "ima2.generate_image": "agent.toolLabel.generateImage",
  "ima2.generate_video": "agent.toolLabel.generateVideo",
  "ima2.get_generation_errors": "agent.toolLabel.getGenerationErrors",
};

export function agentToolLabelKey(name: string): string | null {
  return TOOL_LABEL_KEYS[name] ?? null;
}

const PREVIEW_MAX = 72;

/**
 * One-line argument preview for a collapsed tool row. Collapses whitespace and
 * truncates on a word boundary so the row height never changes.
 */
export function formatToolArgPreview(value?: string | null, max = PREVIEW_MAX): string | null {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (normalized.length <= max) return normalized;
  const cut = normalized.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const head = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${head.trimEnd()}…`;
}
