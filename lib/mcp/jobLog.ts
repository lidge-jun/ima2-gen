// MCP job lifecycle log (260718): one JSON line per event in jobs.log next to
// the provider token store. Signed URLs and full prompts are never written —
// taskId + query-stripped URL + truncated prompt only. Never throws into the
// job path.
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { scrubValue } from "./sanitizer.js";

export type McpJobLogEvent = {
  event: "submitted" | "taskId" | "succeeded" | "download-attempt-failed" | "error" | "done" | "recovered";
  requestId?: string | undefined;
  provider?: string | undefined;
  taskId?: string | undefined;
  sanitizedUrl?: string | undefined;
  prompt?: string | undefined;
  code?: string | undefined;
  cause?: string | undefined;
};

export function mcpJobLogPath(generatedDir: string): string {
  return join(dirname(generatedDir), "mcp", "jobs.log");
}

function causeMessage(error: unknown): string | undefined {
  const cause = (error as { cause?: unknown })?.cause;
  if (!cause) return undefined;
  const code = (cause as { code?: unknown })?.code;
  const message = (cause as { message?: unknown })?.message;
  const joined = [code, message].filter((part) => typeof part === "string" && part).join(":") || String(cause).slice(0, 160);
  // Secret-scrub (030): nested causes can carry signed URLs/tokens from providers.
  return scrubValue(joined);
}

export async function appendMcpJobLog(generatedDir: string, entry: McpJobLogEvent): Promise<void> {
  try {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      ...entry,
      ...(entry.prompt ? { prompt: entry.prompt.slice(0, 120) } : {}),
    });
    const path = mcpJobLogPath(generatedDir);
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, line + "\n");
  } catch (error) {
    console.warn("[mcp.joblog] append failed:", (error as Error)?.message ?? error);
  }
}

export function logMcpJobError(generatedDir: string, entry: Omit<McpJobLogEvent, "event" | "cause">, error: unknown): Promise<void> {
  return appendMcpJobLog(generatedDir, {
    ...entry, event: "error",
    code: scrubValue((String((error as Error)?.message ?? error).split(":")[0] ?? "").slice(0, 80)),
    ...(causeMessage(error) ? { cause: causeMessage(error) } : {}),
  });
}
