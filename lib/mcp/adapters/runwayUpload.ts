// Runway local-media upload (060 WP6): init_upload -> PUT parts -> complete_upload.
// Every PUT destination gets the same public-HTTPS/IP validation as downloads —
// hostile MCP output must not redirect local media elsewhere.
import { readFile } from "node:fs/promises";
import type { McpConnectionManager } from "../connectionManager.js";
import { assertPublicHttps } from "../downloadMediaResult.js";
import { collectResultText, extractHttpsUrls } from "../providerAdapter.js";

const RATIONALE = "ima2 local studio: uploading a user-owned local media file as generation input.";

function structuredOf(result: Record<string, unknown>): Record<string, unknown> {
  const value = result.structuredContent;
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function findUploadUrls(result: Record<string, unknown>): string[] {
  const structured = structuredOf(result);
  for (const key of ["uploadUrls", "urls", "parts"]) {
    const value = structured[key];
    if (Array.isArray(value) && value.length) {
      const urls = value.map((v) => (typeof v === "string" ? v : (v as { url?: string })?.url)).filter((v): v is string => typeof v === "string");
      if (urls.length) return urls;
    }
  }
  if (typeof structured.uploadUrl === "string") return [structured.uploadUrl];
  // Live shape (2026-07): text-only response embedding presigned PUT URLs
  // (X-Amz-* query params) inside a curl example.
  return extractHttpsUrls(collectResultText(result)).filter((u) => /[?&]X-Amz-/i.test(u));
}

function findUploadId(result: Record<string, unknown>): string | null {
  const structured = structuredOf(result);
  if (typeof structured.uploadId === "string") return structured.uploadId;
  const match = collectResultText(result).match(/uploadId:?\s*`?([0-9a-f-]{36})/i);
  return match?.[1] ?? null;
}

/** Upload a validated local file; returns the Runway-hosted asset URL. */
export async function uploadLocalMediaToRunway(
  manager: McpConnectionManager,
  filePath: string,
  options: { fileName: string; mimeType: string; maxBytes?: number },
): Promise<string> {
  const bytes = await readFile(filePath);
  if (bytes.byteLength === 0) throw new Error("MCP_UPLOAD_EMPTY");
  if (bytes.byteLength > (options.maxBytes ?? 100 * 1024 * 1024)) throw new Error("MCP_UPLOAD_TOO_LARGE");

  const init = await manager.callTool("runway", "init_upload", {
    rationale: RATIONALE,
    filename: options.fileName,
    fileSize: bytes.byteLength,
    mimeType: options.mimeType,
  });
  const uploadId = findUploadId(init);
  const uploadUrls = findUploadUrls(init);
  if (!uploadId || uploadUrls.length === 0) throw new Error("MCP_UPLOAD_INIT_INVALID");

  // Single-part upload: PUT the whole file to the first URL (fixture: parts[] is
  // required even for single-part uploads).
  const firstUpload = uploadUrls[0];
  if (!firstUpload) throw new Error("MCP_UPLOAD_INIT_INVALID");
  const target = new URL(firstUpload);
  await assertPublicHttps(target);
  const response = await fetch(target, {
    method: "PUT",
    redirect: "error",
    body: bytes,
    headers: { "content-type": options.mimeType, "content-length": String(bytes.byteLength) },
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) throw new Error(`MCP_UPLOAD_PUT_FAILED:${response.status}`);
  const etag = response.headers.get("etag");
  if (!etag) throw new Error("MCP_UPLOAD_ETAG_MISSING");

  const complete = await manager.callTool("runway", "complete_upload", {
    rationale: RATIONALE,
    uploadId,
    parts: [{ partNumber: 1, etag: etag.replaceAll('"', "") }],
  });
  const assetUrl =
    (typeof structuredOf(complete).url === "string" && (structuredOf(complete).url as string)) ||
    extractHttpsUrls(collectResultText(complete)).find((u) => /\/datasets?\//.test(u) && !/[?&]X-Amz-/i.test(u)) ||
    extractHttpsUrls(collectResultText(complete))[0];
  if (!assetUrl) throw new Error("MCP_UPLOAD_COMPLETE_INVALID");
  return assetUrl;
}
