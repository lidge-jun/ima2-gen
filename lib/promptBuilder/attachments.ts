import {
  MAX_ATTACHMENTS,
  MAX_TEXT_ATTACHMENT_CHARS,
  MAX_ATTACHMENT_NAME_CHARS,
  MAX_ATTACHMENT_MIME_CHARS,
} from "./constants.js";
import type { PromptBuilderAttachment } from "./types.js";

export function normalizeAttachments(
  raw: unknown,
): PromptBuilderAttachment[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const attachments = raw.slice(0, MAX_ATTACHMENTS).flatMap((attachment): PromptBuilderAttachment[] => {
    if (!attachment || typeof attachment !== "object") return [];
    const item = attachment as Record<string, unknown>;
    const kind =
      item.kind === "image" || item.kind === "text" || item.kind === "file"
        ? item.kind
        : "file";
    const name =
      typeof item.name === "string" && item.name.trim()
        ? item.name.trim().slice(0, MAX_ATTACHMENT_NAME_CHARS)
        : "attachment";
    const mimeType =
      typeof item.mimeType === "string" && item.mimeType.trim()
        ? item.mimeType.trim().slice(0, MAX_ATTACHMENT_MIME_CHARS)
        : "application/octet-stream";
    const size =
      typeof item.size === "number" && Number.isFinite(item.size)
        ? Math.max(0, Math.trunc(item.size))
        : 0;
    if (kind === "image") {
      const dataUrl =
        typeof item.dataUrl === "string" && item.dataUrl.startsWith("data:image/")
          ? item.dataUrl
          : "";
      if (!dataUrl) return [];
      return [{ kind, name, mimeType, size, dataUrl }];
    }
    if (kind === "text") {
      const text = typeof item.text === "string" ? item.text.slice(0, MAX_TEXT_ATTACHMENT_CHARS) : "";
      return [{ kind, name, mimeType, size, text }];
    }
    return [{ kind, name, mimeType, size }];
  });
  return attachments.length > 0 ? attachments : undefined;
}

export function attachmentText(
  attachments: PromptBuilderAttachment[] | undefined,
): string {
  if (!attachments || attachments.length === 0) return "";
  const lines = attachments.flatMap((attachment, index) => {
    const label = `Attachment ${index + 1}: ${attachment.name} (${attachment.mimeType}, ${attachment.size} bytes)`;
    if (attachment.kind === "text" && attachment.text?.trim()) {
      return [`${label}\n${attachment.text.trim()}`];
    }
    if (attachment.kind === "image") {
      return [`${label}\nImage is attached as visual reference.`];
    }
    return [label];
  });
  return `User attachments:\n${lines.join("\n\n")}`;
}

export function hasImageAttachments(
  messages: Array<{ attachments?: PromptBuilderAttachment[] | undefined }>,
): boolean {
  return messages.some((message) =>
    message.attachments?.some(
      (attachment) => attachment.kind === "image" && attachment.dataUrl,
    ),
  );
}
