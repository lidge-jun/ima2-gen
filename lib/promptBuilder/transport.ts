import { attachmentText, hasImageAttachments } from "./attachments.js";
import {
  PROMPT_BUILDER_RESPONSE_MAX_OUTPUT_TOKENS,
  type ResolvedPromptBuilderBackend,
} from "./constants.js";
import { PROMPT_BUILDER_SYSTEM_PROMPT } from "./systemPrompt.js";
import { contextText } from "./context.js";
import type {
  PromptBuilderMessage,
  PromptBuilderContext,
  ChatContentPart,
  ResponsesContentPart,
} from "./types.js";

function toChatContent(
  message: PromptBuilderMessage,
): string | ChatContentPart[] {
  const text = [message.content, attachmentText(message.attachments)]
    .filter(Boolean)
    .join("\n\n");
  const imageParts = (message.attachments ?? [])
    .filter((a) => a.kind === "image" && a.dataUrl)
    .map(
      (a): ChatContentPart => ({
        type: "image_url",
        image_url: { url: a.dataUrl as string },
      }),
    );
  if (imageParts.length === 0) return text;
  return [{ type: "text", text }, ...imageParts];
}

function toResponsesContent(
  message: PromptBuilderMessage,
): string | ResponsesContentPart[] {
  const text = [message.content, attachmentText(message.attachments)]
    .filter(Boolean)
    .join("\n\n");
  const imageParts = (message.attachments ?? [])
    .filter((a) => a.kind === "image" && a.dataUrl)
    .map(
      (a): ResponsesContentPart => ({
        type: "input_image",
        image_url: a.dataUrl as string,
      }),
    );
  if (imageParts.length === 0) return text;
  return [{ type: "input_text", text }, ...imageParts];
}

export type TransportPayload = {
  endpoint: "chat" | "responses";
  body: Record<string, unknown>;
};

export function buildTransportPayload(
  backend: ResolvedPromptBuilderBackend,
  model: string,
  messages: PromptBuilderMessage[],
  context: PromptBuilderContext | undefined,
): TransportPayload {
  const currentContextText = contextText(context);
  const systemText = [
    PROMPT_BUILDER_SYSTEM_PROMPT,
    currentContextText ? `Current ima2-gen context:\n${currentContextText}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const useResponses = backend === "api"
    || (backend === "oauth" && hasImageAttachments(messages));
  const endpoint = useResponses ? "responses" : "chat";

  const body = useResponses
    ? {
        model,
        instructions: systemText,
        input: messages.map((m) => ({
          role: m.role,
          content: toResponsesContent(m),
        })),
        stream: true,
        max_output_tokens: PROMPT_BUILDER_RESPONSE_MAX_OUTPUT_TOKENS,
      }
    : {
        model,
        messages: [
          { role: "system", content: systemText },
          ...messages.map((m) => ({
            role: m.role,
            content: toChatContent(m),
          })),
        ],
        stream: false,
        ...(backend === "oauth" ? { reasoning_effort: "low" } : {}),
      };

  return { endpoint, body };
}
