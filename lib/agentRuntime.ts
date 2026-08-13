import { ulid } from "ulid";
import { config } from "../config.js";
import { generateAgentImageWithRetry } from "./agentImageVideoGen.js";
import { runAgentVideoGeneration } from "./agentImageVideoGen.js";
import {
  appendAgentTurn,
  buildImageContextManifest,
  getAgentSession,
  recordAgentWebFinding,
  restartAgentRuntimeSession,
} from "./agentStore.js";
import {
  AGENT_ALLOWED_TOOLS,
  type AgentGenerationErrorRecord,
  type AgentGenerationPlan,
  type AgentSourceImagePolicy,
  type AgentToolCallSummary,
  type AgentToolName,
  type AgentVideoParams,
} from "./agentTypes.js";
import { getAgentGenerationErrors } from "./agentQueueStore.js";
import { AGENT_TOOL_MANIFEST } from "./agentToolManifest.js";
import { errInfo } from "./errInfo.js";
import { type RuntimeContext } from "./runtimeContext.js";

export type AgentRunOptions = {
  provider?: string | undefined;
  quality?: string | undefined;
  size?: string | undefined;
  format?: string | undefined;
  moderation?: string | undefined;
  model?: string | undefined;
  reasoningEffort?: string | undefined;
  requestId?: string | undefined;
  webSearchEnabled?: boolean | undefined;
  parallelism?: number | undefined;
  signal?: AbortSignal | null | undefined;
  videoParams?: AgentVideoParams | null | undefined;
  sourceImagePolicy?: AgentSourceImagePolicy | null | undefined;
  onProgressStage?: (stage: "requesting" | "polling" | "downloading") => void | undefined;
};

export function assertAgentAllowedTools(tools: readonly string[]) {
  const allowed = new Set<string>(AGENT_ALLOWED_TOOLS);
  const denied = tools.filter((tool) => !allowed.has(tool));
  if (denied.length > 0) {
    const err = new Error(`Agent tool is not allowed: ${denied.join(", ")}`) as Error & {
      code?: string | undefined;
      status?: number | undefined;
      deniedTools?: string[] | undefined;
    };
    err.code = "AGENT_TOOL_NOT_ALLOWED";
    err.status = 403;
    err.deniedTools = denied;
    throw err;
  }
}

export function agentAllowedToolPayload() {
  return { tools: [...AGENT_ALLOWED_TOOLS], manifest: [...AGENT_TOOL_MANIFEST] };
}

export async function runAgentTurn(ctx: RuntimeContext, sessionId: string, prompt: string, options: AgentRunOptions = {}) {
  return runAgentGenerationPlan(
    ctx,
    sessionId,
    prompt,
    {
      mode: "single",
      prompts: [prompt],
      requestedVariants: 1,
      plannedVariants: 1,
      plannedParallelism: cleanParallelism(options.parallelism),
      source: "auto-default",
      reason: "Direct turn endpoint defaults to one image.",
      command: null,
      assistantText: null,
      sourceImagePolicy: "none",
    },
    options,
    { appendUserTurn: true },
  );
}

export async function runAgentGenerationPlan(
  ctx: RuntimeContext,
  sessionId: string,
  prompt: string,
  plan: AgentGenerationPlan,
  options: AgentRunOptions = {},
  behavior: { appendUserTurn?: boolean | undefined } = {},
) {
  const session = getAgentSession(sessionId);
  if (!session) throw notFound(sessionId);
  const webSearchEnabled = options.provider === "agy" ? false : options.provider === "grok" ? true : options.webSearchEnabled ?? session.webSearchEnabled;
  const enabledTools: AgentToolName[] = webSearchEnabled
    ? [...AGENT_ALLOWED_TOOLS]
    : ["ima2.get_image_context", "ima2.generate_image", "ima2.generate_video", "ima2.get_generation_errors"];
  assertAgentAllowedTools(enabledTools);
  if (behavior.appendUserTurn !== false) {
    appendAgentTurn({ sessionId, role: "user", text: prompt, status: "complete" });
  }
  if (plan.mode === "question") {
    const assistantTurn = appendAgentTurn({
      sessionId,
      role: "assistant",
      text: plan.assistantText || plan.reason || "What would you like to clarify before generating images?",
      imageIds: [],
      webFindingIds: [],
      status: "complete",
    });
    return { assistantTurn, imageIds: [], webFindingIds: [] };
  }
  if (plan.mode === "errors") {
    return runAgentErrorLookup(sessionId, plan);
  }
  const preludeSent = appendPlannerPreludeTurn(sessionId, plan);
  if (plan.mode === "video") {
    return runAgentVideoGeneration(ctx, sessionId, plan.prompts[0] ?? prompt, {
      ...options,
      videoParams: plan.videoParams ?? options.videoParams ?? null,
      assistantText: preludeSent ? null : plan.assistantText,
      requestId: options.requestId ?? `agent_video_${ulid()}`,
      skipUserTurn: true,
    });
  }
  const manifest = buildImageContextManifest(sessionId);
  const contextStartedAt = Date.now();
  appendAgentTurn({
    sessionId,
    role: "tool",
    text: "ima2.get_image_context",
    status: "complete",
    raw: {
      toolCalls: [{
        id: `tc_context_${ulid()}`,
        name: "ima2.get_image_context",
        status: "complete",
        startedAt: contextStartedAt,
        finishedAt: Date.now(),
        durationMs: Date.now() - contextStartedAt,
        outputSummary: "Loaded current image context manifest.",
      } satisfies AgentToolCallSummary],
    },
  });
  const generationPrompts = plan.prompts.length > 0 ? plan.prompts : [prompt];
  const baseRequestId = options.requestId ?? `agent_${ulid()}`;
  const generationResults = await mapWithLimit(generationPrompts, cleanParallelism(plan.plannedParallelism ?? options.parallelism), async (generationPrompt, index) => {
    const requestId = generationPrompts.length > 1 ? `${baseRequestId}_${index + 1}` : baseRequestId;
    const startedAt = Date.now();
    const result = await runGeneratorWithRuntimeRecovery(ctx, sessionId, generationPrompt, manifest, webSearchEnabled, {
      ...options,
      requestId,
      sourceImagePolicy: plan.sourceImagePolicy ?? "none",
    });
    const findingIds = recordSearchFindings(sessionId, generationPrompt, result.webSearchCalls, result.provider ?? "oauth");
    const finishedAt = Date.now();
    return {
      prompt: generationPrompt,
      imageId: result.image.id,
      text: result.text,
      findingIds,
      toolCall: {
        id: `tc_generate_${ulid()}`,
        name: "ima2.generate_image",
        status: "complete",
        startedAt,
        finishedAt,
        durationMs: finishedAt - startedAt,
        requestId,
        inputSummary: generationPrompt,
        outputSummary: `Generated ${result.image.filename}. ${plan.reason}`,
        imageIds: [result.image.id],
        webFindingIds: findingIds,
      } satisfies AgentToolCallSummary,
    };
  });
  const imageIds = generationResults.map((result) => result.imageId);
  const responseTexts = generationResults
    .map((result) => result.text)
    .filter((text): text is string => typeof text === "string" && text.trim().length > 0);
  const findingIds = generationResults.flatMap((result) => result.findingIds);
  const webToolCall: AgentToolCallSummary | null = webSearchEnabled ? {
    id: `tc_web_${ulid()}`,
    name: "ima2.web_search",
    status: "complete",
    outputSummary: findingIds.length > 0
      ? `Recorded ${findingIds.length} web finding${findingIds.length === 1 ? "" : "s"}.`
      : "Web search enabled; no findings were reported.",
    webFindingIds: findingIds,
  } : null;
  appendAgentTurn({
    sessionId,
    role: "tool",
    text: webSearchEnabled ? "ima2.web_search + ima2.generate_image" : "ima2.generate_image",
    imageIds,
    webFindingIds: findingIds,
    status: "complete",
    raw: {
      toolCalls: [
        ...(webToolCall ? [webToolCall] : []),
        ...generationResults.map((result) => result.toolCall),
      ],
    },
  });
  const assistantTurn = appendAgentTurn({
    sessionId,
    role: "assistant",
    text: formatAgentAssistantText(plan, prompt, imageIds.length, responseTexts, preludeSent),
    imageIds,
    webFindingIds: findingIds,
    status: "complete",
  });
  return { assistantTurn, imageIds, webFindingIds: findingIds };
}

function appendPlannerPreludeTurn(sessionId: string, plan: AgentGenerationPlan): boolean {
  const text = plan.assistantText?.trim();
  if (!text) return false;
  appendAgentTurn({
    sessionId,
    role: "assistant",
    text,
    imageIds: [],
    webFindingIds: [],
    status: "complete",
  });
  return true;
}

function runAgentErrorLookup(sessionId: string, plan: AgentGenerationPlan) {
  const startedAt = Date.now();
  const errors = getAgentGenerationErrors(sessionId, 10);
  appendAgentTurn({
    sessionId,
    role: "tool",
    text: "ima2.get_generation_errors",
    status: "complete",
    raw: {
      toolCalls: [{
        id: `tc_errors_${ulid()}`,
        name: "ima2.get_generation_errors",
        status: "complete",
        startedAt,
        finishedAt: Date.now(),
        durationMs: Date.now() - startedAt,
        outputSummary: errors.length > 0
          ? `Found ${errors.length} recent generation error${errors.length === 1 ? "" : "s"}.`
          : "No recent generation errors recorded for this session.",
      } satisfies AgentToolCallSummary],
    },
  });
  const assistantTurn = appendAgentTurn({
    sessionId,
    role: "assistant",
    text: plan.assistantText?.trim() || formatGenerationErrors(errors),
    imageIds: [],
    webFindingIds: [],
    status: "complete",
  });
  return { assistantTurn, imageIds: [] as string[], webFindingIds: [] as string[] };
}

function formatGenerationErrors(errors: readonly AgentGenerationErrorRecord[]): string {
  if (errors.length === 0) return "No generation errors are recorded for this session.";
  const lines = errors.map((error, index) => {
    const when = new Date(error.at).toISOString();
    const code = error.code ? ` [${error.code}]` : "";
    const promptPart = error.prompt ? ` (prompt: ${error.prompt.slice(0, 80)})` : "";
    return `${index + 1}. ${when}${code} ${error.message}${promptPart}`;
  });
  return `Recent generation errors (most recent first):\n${lines.join("\n")}`;
}

function formatAgentAssistantText(
  plan: AgentGenerationPlan,
  prompt: string,
  imageCount: number,
  responseTexts: readonly string[],
  omitPlannerText = false,
): string {
  // Behave like a normal chat agent: prefer the planner's natural-language
  // reply, then any text the image model returned. The mechanical summary is
  // only the fallback when neither produced prose.
  const plannerText = omitPlannerText ? "" : (plan.assistantText?.trim() ?? "");
  const modelText = responseTexts.join("\n\n").trim();
  const prose = [plannerText, modelText].filter(Boolean).join("\n\n");
  if (prose) return prose;
  const languageProbe = [prompt, ...plan.prompts].find((item) => item.trim().length > 0) ?? "";
  const isKorean = /[\uAC00-\uD7AF]/u.test(languageProbe);
  if (isKorean) return imageCount === 1 ? "이미지 생성이 완료됐어요." : `이미지 ${imageCount}장을 생성했어요.`;
  return imageCount === 1 ? "Done - I generated the image." : `Done - I generated ${imageCount} images.`;
}

async function runGeneratorWithRuntimeRecovery(
  ctx: RuntimeContext,
  sessionId: string,
  prompt: string,
  manifest: string,
  webSearchEnabled: boolean,
  options: AgentRunOptions,
) {
  try {
    return await generateAgentImageWithRetry(ctx, sessionId, prompt, manifest, webSearchEnabled, options);
  } catch (error) {
    if (options.signal?.aborted) throw error;
    const err = errInfo(error);
    if (isRuntimeRestartableError(error)) {
      restartAgentRuntimeSession(sessionId, err.code || err.message);
    }
    appendAgentTurn({ sessionId, role: "assistant", text: err.message, status: "error" });
    markAgentErrorTurnRecorded(error);
    throw error;
  }
}

export function markAgentErrorTurnRecorded(error: unknown) {
  if (error && typeof error === "object") {
    (error as { agentErrorTurnRecorded?: boolean | undefined }).agentErrorTurnRecorded = true;
  }
}

export function hasAgentErrorTurnRecorded(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { agentErrorTurnRecorded?: boolean | undefined }).agentErrorTurnRecorded);
}

export function isRuntimeRestartableError(error: unknown) {
  const err = errInfo(error);
  const code = err.code || "";
  return (
    code.includes("AUTH") ||
    code.includes("TIMEOUT") ||
    code.includes("PROTOCOL") ||
    err.message.toLowerCase().includes("protocol wedge")
  );
}


function recordSearchFindings(sessionId: string, prompt: string, count: number, provider: string) {
  if (!count) return [];
  const providerLabel = provider === "grok" ? "Grok" : provider === "agy" ? "Gemini" : "Responses";
  return [
    recordAgentWebFinding({
      sessionId,
      query: prompt,
      title: `${providerLabel} visual research`,
      snippet: `${providerLabel} reported ${count} web search call${count === 1 ? "" : "s"}.`,
    }),
  ];
}

export function forceImagePrompt(prompt: string) {
  return [
    "The previous turn did not return an image artifact.",
    "Return a final image using ima2.generate_image/image_generation now.",
    `User request: ${prompt}`,
  ].join("\n");
}

export function isTextOnlyResult(error: unknown) {
  const err = errInfo(error);
  return [
    "EMPTY_RESPONSE",
    "IMAGE_TOOL_NOT_CALLED",
    "WEB_SEARCH_ONLY_RESPONSE",
    "IMAGE_TOOL_COMPLETED_WITHOUT_RESULT",
  ].includes(err.code || "") || err.message.includes("No image data");
}

export function textOnlyError(cause: unknown) {
  const err = new Error("Agent result did not include an image artifact.") as Error & {
    code?: string | undefined;
    status?: number | undefined;
    cause?: unknown | undefined;
  };
  err.code = "AGENT_TEXT_ONLY_RESULT";
  err.status = 422;
  err.cause = cause;
  return err;
}

async function mapWithLimit<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const item = items[currentIndex];
      if (item === undefined) continue;
      results[currentIndex] = await mapper(item, currentIndex);
    }
  }));
  return results;
}

function cleanParallelism(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 2;
  return Math.max(1, Math.min(config.limits.maxParallel, Math.round(numeric)));
}

export function notFound(sessionId: string) {
  const err = new Error(`Agent session not found: ${sessionId}`) as Error & { code?: string | undefined; status?: number | undefined };
  err.code = "AGENT_SESSION_NOT_FOUND";
  err.status = 404;
  return err;
}
