import type { CoreProviderId } from "../../generated/providers";
import type { AgentLlmModelOption } from "../../lib/agentModelOptions";

export type AgentLayoutMode =
  | "desktop-three-pane"
  | "desktop-rail"
  | "tablet-stacked"
  | "mobile-chat-image-sheet";

export type AgentRuntimeStatus = "ready" | "generating" | "reconnecting";
export type AgentToolName =
  | "ima2.get_image_context"
  | "ima2.web_search"
  | "ima2.generate_image"
  | "ima2.generate_video"
  | "ima2.get_generation_errors";
export type AgentToolCallStatus = "queued" | "running" | "complete" | "error";
export type AgentQueueStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";
export type AgentSessionRunStatus = "idle" | "queued" | "running" | "error";
export type AgentGenerationStrategy = "auto" | "manual";
export type AgentSidebarTab = "image" | "library" | "forms" | "quality" | "model" | "queue";
export type AgentSourceImagePolicy = "auto" | "none" | "current";

export type AgentGenerationSettings = {
  provider: Extract<CoreProviderId, AgentLlmModelOption["provider"]>;
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
};

export type AgentToolCallSummary = {
  id: string;
  name: AgentToolName;
  status: AgentToolCallStatus;
  startedAt?: number | null;
  finishedAt?: number | null;
  durationMs?: number | null;
  requestId?: string | null;
  inputSummary?: string | null;
  outputSummary?: string | null;
  imageIds?: string[];
  webFindingIds?: string[];
  errorCode?: string | null;
  errorMessage?: string | null;
};

export type AgentVideoParams = {
  duration?: number;
  resolution?: "480p" | "720p" | "1080p";
  aspectRatio?: string;
};

export type AgentGenerationPlan = {
  mode: "single" | "fanout" | "question" | "video" | "errors";
  prompts: string[];
  requestedVariants: number;
  plannedVariants: number;
  plannedParallelism: number;
  source: "auto-default" | "auto-request" | "manual-settings" | "slash-command" | "question-command" | "llm-planner";
  reason: string;
  command?: "question" | "help" | "variants" | "generate" | "parallelism" | null;
  assistantText?: string | null;
  videoParams?: AgentVideoParams | null;
  sourceImagePolicy?: AgentSourceImagePolicy | null;
};

export type AgentQueueItem = {
  id: string;
  sessionId: string;
  requestId: string;
  prompt: string;
  status: AgentQueueStatus;
  position: number;
  resultImageIds: string[];
  errorCode?: string | null;
  errorClass?: string | null;
  errorMessage?: string | null;
  createdAt: number;
  startedAt?: number | null;
  finishedAt?: number | null;
  progressStage?: "requesting" | "polling" | "downloading" | null;
  options: AgentGenerationSettings;
  plan: AgentGenerationPlan;
};

export type AgentSessionRunSummary = {
  status: AgentSessionRunStatus;
  queuedCount: number;
  runningCount: number;
  lastQueueItemId?: string | null;
  lastError?: string | null;
};

export type AgentSessionSummary = {
  id: string;
  title: string;
  codexThreadId?: string | null;
  lastTurnId?: string | null;
  lastImageId?: string | null;
  imageCount: number;
  compacted: boolean;
  webSearchEnabled: boolean;
  generationSettings: AgentGenerationSettings;
  updatedAt: number;
};

export type AgentTurn = {
  id: string;
  role: "user" | "assistant" | "tool";
  text: string;
  imageIds?: string[];
  webFindingIds?: string[];
  status?: "streaming" | "complete" | "error";
  toolCalls?: AgentToolCallSummary[];
  createdAt?: number;
};

export type AgentImageHandle = {
  id: string;
  filename: string;
  url: string;
  thumbUrl?: string;
  prompt?: string | null;
  revisedPrompt?: string | null;
  createdAt: number;
  width?: number | null;
  height?: number | null;
};

export type AgentContextTab = "image" | "refs" | "web" | "memory";

export type AgentWorkspaceSeed = {
  sessions: AgentSessionSummary[];
  turnsBySession: Record<string, AgentTurn[]>;
  imagesById: Record<string, AgentImageHandle>;
  imageIdsBySession: Record<string, string[]>;
  selectedSessionId: string;
  currentImageId: string | null;
  allowedTools?: AgentToolName[];
  manifest?: string | null;
  queueBySession?: Record<string, AgentQueueItem[]>;
  runSummaryBySession?: Record<string, AgentSessionRunSummary>;
};

export type AgentWorkspacePayload = Omit<AgentWorkspaceSeed, "selectedSessionId"> & {
  selectedSessionId: string | null;
  allowedTools: AgentToolName[];
  manifest: string | null;
  queueBySession: Record<string, AgentQueueItem[]>;
  runSummaryBySession: Record<string, AgentSessionRunSummary>;
};
