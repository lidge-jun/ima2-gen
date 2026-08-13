import { promptBuilderError } from "./errors.js";
import type {
  PromptBuilderError,
  ResponseShapeSummary,
  ChatCompletionBody,
  ResponsesBody,
  ResponsesReadResult,
} from "./types.js";

function safeUpstreamString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 160)
    : undefined;
}

export function parseUpstreamError(text: string): Pick<
  PromptBuilderError,
  "upstreamCode" | "upstreamType" | "upstreamParam"
> {
  try {
    const body = JSON.parse(text) as { error?: Record<string, unknown> };
    const error =
      body && typeof body.error === "object" ? body.error : undefined;
    return {
      upstreamCode: safeUpstreamString(error?.code),
      upstreamType: safeUpstreamString(error?.type),
      upstreamParam: safeUpstreamString(error?.param),
    };
  } catch {
    return {};
  }
}

export function responseSummary(body: unknown): ResponseShapeSummary {
  if (!body || typeof body !== "object") {
    return {
      responseBodyKeys: "",
      responseStatus: undefined,
      responseErrorCode: undefined,
      responseErrorType: undefined,
      responseErrorParam: undefined,
      responseIncompleteReason: undefined,
      responseOutputTypes: "",
      responseContentTypes: "",
      responseOutputCount: 0,
      responseContentCount: 0,
    };
  }
  const record = body as Record<string, unknown>;
  const output = Array.isArray(record.output) ? record.output : [];
  const error =
    record.error && typeof record.error === "object"
      ? (record.error as Record<string, unknown>)
      : undefined;
  const incomplete =
    record.incomplete_details && typeof record.incomplete_details === "object"
      ? (record.incomplete_details as Record<string, unknown>)
      : undefined;
  const contentItems = output.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const content = (item as { content?: unknown | undefined }).content;
    return Array.isArray(content) ? content : [];
  });
  const outputTypes = output
    .map((item) =>
      item && typeof item === "object"
        ? (item as { type?: unknown | undefined }).type
        : undefined,
    )
    .filter((t): t is string => typeof t === "string" && t.length > 0);
  const contentTypes = contentItems
    .map((item) =>
      item && typeof item === "object"
        ? (item as { type?: unknown | undefined }).type
        : undefined,
    )
    .filter((t): t is string => typeof t === "string" && t.length > 0);
  return {
    responseBodyKeys: Object.keys(record).slice(0, 12).join(","),
    responseStatus: safeUpstreamString(record.status),
    responseErrorCode: safeUpstreamString(error?.code),
    responseErrorType: safeUpstreamString(error?.type),
    responseErrorParam: safeUpstreamString(error?.param),
    responseIncompleteReason: safeUpstreamString(incomplete?.reason),
    responseOutputTypes: Array.from(new Set(outputTypes))
      .slice(0, 12)
      .join(","),
    responseContentTypes: Array.from(new Set(contentTypes))
      .slice(0, 12)
      .join(","),
    responseOutputCount: output.length,
    responseContentCount: contentItems.length,
  };
}

function extractSseData(block: string): string {
  return block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
}

function parseSseJson(block: string): Record<string, unknown> | null {
  const data = extractSseData(block);
  if (!data || data === "[DONE]") return null;
  try {
    const parsed = JSON.parse(data) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function extractChatText(body: ChatCompletionBody): string {
  return (
    body.choices?.find(
      (c) => typeof c.message?.content === "string" && c.message.content.trim(),
    )?.message?.content ?? ""
  );
}

export function extractResponsesText(body: ResponsesBody): string {
  if (typeof body.output_text === "string" && body.output_text.trim())
    return body.output_text;
  for (const item of body.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string" && content.text.trim())
        return content.text;
      if (
        content.text &&
        typeof content.text === "object" &&
        typeof content.text.value === "string" &&
        content.text.value.trim()
      )
        return content.text.value;
      if (typeof content.value === "string" && content.value.trim())
        return content.value;
      if (typeof content.refusal === "string" && content.refusal.trim())
        return content.refusal;
    }
  }
  return "";
}

export async function readResponsesStream(
  res: Response,
): Promise<ResponsesReadResult> {
  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  const deltas: string[] = [];
  let buffer = "";
  let usage: Record<string, unknown> | null = null;
  let summary = responseSummary(null);
  if (!reader) return { content: "", usage, summary };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = parseSseJson(block);
      if (data) {
        const type = typeof data.type === "string" ? data.type : "";
        if (
          type === "response.output_text.delta" &&
          typeof data.delta === "string"
        ) {
          deltas.push(data.delta);
        } else if (
          (type === "response.completed" || type === "response.incomplete") &&
          data.response &&
          typeof data.response === "object"
        ) {
          const response = data.response as Record<string, unknown>;
          summary = responseSummary(response);
          if (response.usage && typeof response.usage === "object")
            usage = response.usage as Record<string, unknown>;
        } else if (type === "error") {
          throw promptBuilderError(
            "Prompt builder stream failed",
            "PROMPT_BUILDER_STREAM_ERROR",
            502,
          );
        }
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
  if (buffer.trim()) {
    const data = parseSseJson(buffer);
    if (
      data?.type === "response.output_text.delta" &&
      typeof data.delta === "string"
    ) {
      deltas.push(data.delta);
    }
  }
  return { content: deltas.join(""), usage, summary };
}

export async function readResponsesResult(
  res: Response,
): Promise<ResponsesReadResult> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    return readResponsesStream(res);
  }
  const body = (await res.json()) as ResponsesBody;
  return {
    content: extractResponsesText(body),
    usage: body.usage ?? null,
    summary: responseSummary(body),
  };
}
