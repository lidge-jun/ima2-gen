import type {
  PromptBuilderBackend,
  ResolvedPromptBuilderBackend,
} from "./constants.js";

export type PromptBuilderRole = "user" | "assistant";

export type PromptBuilderAttachment = {
  kind: "image" | "text" | "file";
  name: string;
  mimeType: string;
  size: number;
  dataUrl?: string | undefined;
  text?: string | undefined;
};

export type PromptBuilderMessage = {
  role: PromptBuilderRole;
  content: string;
  attachments?: PromptBuilderAttachment[] | undefined;
};

export type PromptBuilderContext = {
  currentPrompt?: string | undefined;
  insertedPrompts?: Array<{ name?: string; text?: string }>;
  settings?: Record<string, unknown> | undefined;
  currentResultPrompt?: string | null | undefined;
};

export type PromptBuilderRequest = {
  backend?: unknown | undefined;
  model?: unknown | undefined;
  messages?: unknown | undefined;
  context?: PromptBuilderContext | undefined;
};

export type PromptBuilderError = Error & {
  status?: number | undefined;
  code?: string | undefined;
  upstreamStatus?: number | undefined;
  upstreamBodyChars?: number | undefined;
  upstreamEndpoint?: "chat" | "responses" | undefined;
  upstreamCode?: string | undefined;
  upstreamType?: string | undefined;
  upstreamParam?: string | undefined;
  responseBodyKeys?: string | undefined;
  responseStatus?: string | undefined;
  responseErrorCode?: string | undefined;
  responseErrorType?: string | undefined;
  responseErrorParam?: string | undefined;
  responseIncompleteReason?: string | undefined;
  responseOutputTypes?: string | undefined;
  responseContentTypes?: string | undefined;
  responseOutputCount?: number | undefined;
  responseContentCount?: number | undefined;
};

export type ResponseShapeSummary = Pick<
  PromptBuilderError,
  | "responseBodyKeys"
  | "responseStatus"
  | "responseErrorCode"
  | "responseErrorType"
  | "responseErrorParam"
  | "responseIncompleteReason"
  | "responseOutputTypes"
  | "responseContentTypes"
  | "responseOutputCount"
  | "responseContentCount"
>;

export type ChatCompletionBody = {
  choices?: Array<{
    message?: {
      role?: string | undefined;
      content?: string | null | undefined;
    };
  }>;
  usage?: Record<string, unknown> | undefined;
};

export type ResponsesBody = {
  output_text?: string | undefined;
  output?: Array<{
    type?: string | undefined;
    content?: Array<{
      type?: string | undefined;
      text?: string | { value?: string } | undefined;
      value?: string | undefined;
      refusal?: string | undefined;
    }>;
  }>;
  usage?: Record<string, unknown> | undefined;
};

export type ResponsesReadResult = {
  content: string;
  usage: Record<string, unknown> | null;
  summary: ResponseShapeSummary;
};

export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ResponsesContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string };

export type PromptBuilderChatResult = {
  provider: ResolvedPromptBuilderBackend;
  backend: ResolvedPromptBuilderBackend;
  requestedBackend: PromptBuilderBackend;
  model: string;
  message: { role: "assistant"; content: string };
  usage: Record<string, unknown> | null;
};

export type PromptBuilderConfig = {
  backend: PromptBuilderBackend;
  model: string;
};

export type PromptBuilderLaneSummary = Record<string, {
  status: "ready" | "locked" | "disconnected" | "key-missing";
  reason?: string;
}>;
