import type { CoreProviderId } from "./providers/registry.js";

export const AGENT_ALLOWED_TOOLS = [
  "ima2.get_image_context",
  "ima2.web_search",
  "ima2.generate_image",
  "ima2.generate_video",
  "ima2.get_generation_errors",
] as const;

export type AgentToolName = typeof AGENT_ALLOWED_TOOLS[number];
export type AgentTurnRole = "user" | "assistant" | "tool";
export type AgentTurnStatus = "streaming" | "complete" | "error";
export type AgentToolCallStatus = "queued" | "running" | "complete" | "error";
export type AgentQueueStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";
export type AgentSessionRunStatus = "idle" | "queued" | "running" | "error";
export type AgentGenerationStrategy = "auto" | "manual";
export type AgentGenerationPlanMode = "single" | "fanout" | "question" | "video" | "errors";
export type AgentGenerationPlanSource = "auto-default" | "auto-request" | "manual-settings" | "slash-command" | "question-command" | "llm-planner";
export type AgentSourceImagePolicy = "auto" | "none" | "current";
export type AgentSlashCommandName = "question" | "help" | "variants" | "generate" | "parallelism";

export interface AgentGenerationSettings {
  provider: CoreProviderId;
  model: string;
  quality: "low" | "medium" | "high";
  size: string;
  format: "png" | "jpeg" | "webp";
  moderation: "auto" | "low";
  reasoningEffort: "none" | "low" | "medium" | "high" | "xhigh" | "max";
  webSearchEnabled: boolean;
  generationStrategy: AgentGenerationStrategy;
  variants: number;
  maxAutoVariants: number;
  parallelism: number;
}

export interface AgentSlashCommand {
  name: AgentSlashCommandName;
  rawName: string;
  raw: string;
  prompt: string;
  value?: number | undefined;
}

export interface AgentToolCallSummary {
  id: string;
  name: AgentToolName;
  status: AgentToolCallStatus;
  startedAt?: number | null | undefined;
  finishedAt?: number | null | undefined;
  durationMs?: number | null | undefined;
  requestId?: string | null | undefined;
  inputSummary?: string | null | undefined;
  outputSummary?: string | null | undefined;
  imageIds?: string[] | undefined;
  webFindingIds?: string[] | undefined;
  errorCode?: string | null | undefined;
  errorMessage?: string | null | undefined;
}

export interface AgentQueueItem {
  id: string;
  sessionId: string;
  requestId: string;
  prompt: string;
  status: AgentQueueStatus;
  position: number;
  resultImageIds: string[];
  errorCode?: string | null | undefined;
  errorClass?: string | null | undefined;
  errorMessage?: string | null | undefined;
  createdAt: number;
  startedAt: number | null;
  finishedAt?: number | null | undefined;
  progressStage?: "requesting" | "polling" | "downloading" | null | undefined;
  options: AgentGenerationSettings;
  plan: AgentGenerationPlan;
}

export interface AgentVideoParams {
  duration?: number | undefined;
  resolution?: "480p" | "720p" | "1080p" | undefined;
  aspectRatio?: string | undefined;
  /**
   * Whether an attached image should become the first frame ("image-to-video") or
   * only guide the result ("reference-to-video"). Chat has no reference tray, so the
   * planner is where that intent gets expressed.
   */
  mode?: "text-to-video" | "image-to-video" | "reference-to-video" | undefined;
}

export interface AgentGenerationPlan {
  mode: AgentGenerationPlanMode;
  prompts: string[];
  requestedVariants: number;
  plannedVariants: number;
  plannedParallelism: number;
  source: AgentGenerationPlanSource;
  reason: string;
  command?: AgentSlashCommandName | null | undefined;
  assistantText?: string | null | undefined;
  videoParams?: AgentVideoParams | null | undefined;
  sourceImagePolicy?: AgentSourceImagePolicy | null | undefined;
}

export interface AgentGenerationErrorRecord {
  scope: "queue" | "turn";
  code: string | null;
  errorClass?: string | null | undefined;
  message: string;
  prompt?: string | null | undefined;
  at: number;
}

export interface AgentSessionRunSummary {
  status: AgentSessionRunStatus;
  queuedCount: number;
  runningCount: number;
  lastQueueItemId?: string | null | undefined;
  lastError?: string | null | undefined;
}

export interface AgentImageInput {
  id?: string | null | undefined;
  filename?: string | null | undefined;
  url?: string | null | undefined;
  thumbUrl?: string | null | undefined;
  prompt?: string | null | undefined;
  revisedPrompt?: string | null | undefined;
  createdAt?: number | null | undefined;
  width?: number | null | undefined;
  height?: number | null | undefined;
}

export interface AgentImageHandle {
  id: string;
  filename: string;
  url: string;
  thumbUrl?: string | null | undefined;
  prompt?: string | null | undefined;
  revisedPrompt?: string | null | undefined;
  createdAt: number;
  width?: number | null | undefined;
  height?: number | null | undefined;
}

export interface AgentSessionSummary {
  id: string;
  title: string;
  codexThreadId: string | null;
  lastTurnId: string | null;
  lastImageId: string | null;
  imageCount: number;
  compacted: boolean;
  webSearchEnabled: boolean;
  generationSettings: AgentGenerationSettings;
  updatedAt: number;
}

export interface AgentTurn {
  id: string;
  role: AgentTurnRole;
  text: string;
  imageIds: string[];
  webFindingIds: string[];
  status: AgentTurnStatus;
  toolCalls?: AgentToolCallSummary[] | undefined;
  createdAt: number;
}

export interface AgentWorkspacePayload {
  sessions: AgentSessionSummary[];
  turnsBySession: Record<string, AgentTurn[]>;
  imagesById: Record<string, AgentImageHandle>;
  imageIdsBySession: Record<string, string[]>;
  selectedSessionId: string | null;
  currentImageId: string | null;
  allowedTools: readonly AgentToolName[];
  manifest: string | null;
  queueBySession: Record<string, AgentQueueItem[]>;
  runSummaryBySession: Record<string, AgentSessionRunSummary>;
}
