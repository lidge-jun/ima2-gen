import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeModel } from "../lib/promptBuilder/requestSchema.ts";

function readSource(path: string): string {
  return readFileSync(path, "utf-8");
}

describe("prompt builder backend contract", () => {
  it("route is registered in routes/index.ts", () => {
    const index = readSource("routes/index.ts");
    assert.match(index, /registerPromptBuilderRoutes/);
    assert.match(index, /\.\/promptBuilder/);
  });

  it("route file registers POST /api/prompt-builder/chat", () => {
    const route = readSource("routes/promptBuilder.ts");
    assert.match(route, /app\.post\(\s*["']\/api\/prompt-builder\/chat["']/);
    assert.match(route, /requestPromptBuilderChat/);
    assert.match(route, /requireRuntimeContext/);
  });

  it("client module orchestrates validate → transport → parse", () => {
    const client = readSource("lib/promptBuilder/client.ts");
    assert.match(client, /normalizeModel/);
    assert.match(client, /normalizeMessages/);
    assert.match(client, /buildTransportPayload/);
    assert.match(client, /waitForOAuthReady/);
    assert.match(client, /fetchOAuth/);
    assert.match(client, /readResponsesResult/);
    assert.match(client, /extractChatText/);
  });

  it("request schema validates model and messages", () => {
    const schema = readSource("lib/promptBuilder/requestSchema.ts");
    assert.match(schema, /VALID_PROMPT_BUILDER_MODELS/);
    assert.match(schema, /PROMPT_BUILDER_BAD_MODEL/);
    assert.match(schema, /PROMPT_BUILDER_BAD_MESSAGES/);
    assert.match(schema, /PROMPT_BUILDER_EMPTY_MESSAGE/);
    assert.match(schema, /normalizeAttachments/);
  });

  it("defaults to Luna and keeps explicit compatibility models", () => {
    assert.equal(normalizeModel(undefined), "gpt-5.6-luna");
    assert.equal(normalizeModel("gpt-5.5"), "gpt-5.5");
    assert.throws(
      () => normalizeModel("gpt-5.6-nova"),
      /gpt-5\.6-luna, gpt-5\.6-terra, gpt-5\.6-sol, gpt-5\.5, gpt-5\.4, gpt-5\.4-mini/,
    );
  });

  it("attachments module caps count and size", () => {
    const attachments = readSource("lib/promptBuilder/attachments.ts");
    assert.match(attachments, /MAX_ATTACHMENTS/);
    assert.match(attachments, /MAX_TEXT_ATTACHMENT_CHARS/);
    assert.match(attachments, /hasImageAttachments/);
  });

  it("transport module builds chat and responses payloads", () => {
    const transport = readSource("lib/promptBuilder/transport.ts");
    assert.match(transport, /toChatContent/);
    assert.match(transport, /toResponsesContent/);
    assert.match(transport, /buildTransportPayload/);
    assert.match(transport, /hasImageAttachments/);
    assert.match(transport, /PROMPT_BUILDER_SYSTEM_PROMPT/);
  });

  it("response parser handles chat text, responses text, and SSE", () => {
    const parser = readSource("lib/promptBuilder/responseParser.ts");
    assert.match(parser, /extractChatText/);
    assert.match(parser, /extractResponsesText/);
    assert.match(parser, /readResponsesStream/);
    assert.match(parser, /readResponsesResult/);
    assert.match(parser, /parseUpstreamError/);
    assert.match(parser, /responseSummary/);
  });

  it("error module follows project error factory pattern", () => {
    const errors = readSource("lib/promptBuilder/errors.ts");
    assert.match(errors, /promptBuilderError/);
    assert.match(errors, /err\.code = code/);
    assert.match(errors, /err\.status = status/);
  });

  it("system prompt file exists and is non-trivial", () => {
    const prompt = readSource("lib/promptBuilder/systemPrompt.ts");
    assert.match(prompt, /PROMPT_BUILDER_SYSTEM_PROMPT/);
    assert.match(prompt, /GPT Image 2/);
    assert.match(prompt, /Final Prompt - Korean/);
    assert.match(prompt, /Final Prompt - English/);
    assert.ok(prompt.length > 2000, "system prompt should be substantial");
  });

  it("context module builds context text from prompt and settings", () => {
    const ctx = readSource("lib/promptBuilder/context.ts");
    assert.match(ctx, /contextText/);
    assert.match(ctx, /Current main prompt/);
    assert.match(ctx, /Inserted prompt blocks/);
    assert.match(ctx, /Generation settings/);
  });

  it("constants module defines limits", () => {
    const constants = readSource("lib/promptBuilder/constants.ts");
    assert.match(constants, /VALID_PROMPT_BUILDER_MODELS/);
    assert.match(constants, /MAX_MESSAGES/);
    assert.match(constants, /MAX_MESSAGE_CHARS/);
    assert.match(constants, /MAX_ATTACHMENTS/);
    assert.match(constants, /PROMPT_BUILDER_RESPONSE_MAX_OUTPUT_TOKENS/);
  });

  it("types module exports all prompt builder types", () => {
    const types = readSource("lib/promptBuilder/types.ts");
    assert.match(types, /PromptBuilderMessage/);
    assert.match(types, /PromptBuilderRequest/);
    assert.match(types, /PromptBuilderError/);
    assert.match(types, /PromptBuilderChatResult/);
    assert.match(types, /ChatCompletionBody/);
    assert.match(types, /ResponsesBody/);
    assert.match(types, /ResponsesReadResult/);
  });

  it("error response includes code field in JSON", () => {
    const route = readSource("routes/promptBuilder.ts");
    assert.match(route, /error:\s*\{\s*code,\s*message/);
    assert.match(route, /PROMPT_BUILDER_UNKNOWN/);
  });

  it("does not log attachment data URLs", () => {
    const client = readSource("lib/promptBuilder/client.ts");
    assert.doesNotMatch(client, /dataUrl/);
    const route = readSource("routes/promptBuilder.ts");
    assert.doesNotMatch(route, /dataUrl/);
  });
});
