import {
  VALID_PROMPT_BUILDER_MODELS,
  DEFAULT_PROMPT_BUILDER_MODEL,
  MAX_MESSAGES,
  MAX_MESSAGE_CHARS,
} from "./constants.js";
import { promptBuilderError } from "./errors.js";
import { normalizeAttachments } from "./attachments.js";
import type { PromptBuilderMessage } from "./types.js";

export function normalizeModel(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim().length === 0) return DEFAULT_PROMPT_BUILDER_MODEL;
  if (!VALID_PROMPT_BUILDER_MODELS.has(raw)) {
    throw promptBuilderError(
      `model must be one of: ${[...VALID_PROMPT_BUILDER_MODELS].join(", ")}`,
      "PROMPT_BUILDER_BAD_MODEL",
    );
  }
  return raw;
}

export function normalizeMessages(raw: unknown): PromptBuilderMessage[] {
  if (!Array.isArray(raw)) {
    throw promptBuilderError("messages must be an array", "PROMPT_BUILDER_BAD_MESSAGES");
  }
  const messages = raw.slice(-MAX_MESSAGES).map((message): PromptBuilderMessage => {
    if (!message || typeof message !== "object") {
      throw promptBuilderError("each message must be an object", "PROMPT_BUILDER_BAD_MESSAGES");
    }
    const item = message as { role?: unknown; content?: unknown; attachments?: unknown };
    const role = item.role === "assistant" ? "assistant" : item.role === "user" ? "user" : null;
    if (!role) {
      throw promptBuilderError(
        "message role must be user or assistant",
        "PROMPT_BUILDER_BAD_MESSAGES",
      );
    }
    const content = typeof item.content === "string" ? item.content.trim() : "";
    if (!content && role === "user") {
      throw promptBuilderError("message content is required", "PROMPT_BUILDER_EMPTY_MESSAGE");
    }
    return {
      role,
      content: content.slice(0, MAX_MESSAGE_CHARS),
      attachments: normalizeAttachments(item.attachments),
    };
  });
  const last = messages.at(-1);
  if (!last || last.role !== "user" || !last.content.trim()) {
    throw promptBuilderError(
      "last message must be a non-empty user message",
      "PROMPT_BUILDER_EMPTY_MESSAGE",
    );
  }
  return messages;
}
