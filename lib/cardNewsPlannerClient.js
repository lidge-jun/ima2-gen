import { config } from "../config.js";
import { CARD_NEWS_PLANNER_SCHEMA } from "./cardNewsPlannerSchema.js";
import { logEvent } from "./logger.js";

function plannerError(message, code, status = 502) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

function extractText(json) {
  if (typeof json.output_text === "string") return json.output_text;
  for (const item of json.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") return content.text;
      if (typeof content.value === "string") return content.value;
    }
  }
  return "";
}

async function requestJson({ oauthUrl, model, messages, timeoutMs, structured, reasoningEffort }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body = {
      model,
      input: messages,
      stream: false,
      ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
      ...(structured
        ? {
            text: {
              format: {
                type: "json_schema",
                name: "card_news_planner_output",
                strict: true,
                schema: CARD_NEWS_PLANNER_SCHEMA,
              },
            },
          }
        : { text: { format: { type: "json_object" } } }),
    };
    const res = await fetch(`${oauthUrl}/v1/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(body),
    });
    logEvent("card-news-planner", "response", { model, status: res.status, structured });
    if (!res.ok) {
      const text = await res.text();
      const err = plannerError("Planner upstream failed", "PLANNER_UPSTREAM_FAILED", 502);
      err.upstreamStatus = res.status;
      err.upstreamBodyChars = text.length;
      throw err;
    }
    const json = await res.json();
    return extractText(json);
  } finally {
    clearTimeout(timer);
  }
}

async function requestChatJson({ oauthUrl, model, messages, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${oauthUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: "json_object" },
      }),
    });
    logEvent("card-news-planner", "chat_response", { model, status: res.status });
    if (!res.ok) {
      const text = await res.text();
      const err = plannerError("Planner upstream failed", "PLANNER_UPSTREAM_FAILED", 502);
      err.upstreamStatus = res.status;
      err.upstreamBodyChars = text.length;
      throw err;
    }
    const json = await res.json();
    return json.choices?.[0]?.message?.content || "";
  } finally {
    clearTimeout(timer);
  }
}

export async function requestCardNewsPlannerJson(input, options = {}) {
  const oauthUrl = options.oauthUrl || `http://127.0.0.1:${config.oauth.proxyPort}`;
  const model = options.model || config.cardNewsPlanner.model;
  const timeoutMs = options.timeoutMs || config.cardNewsPlanner.timeoutMs;
  const reasoningEffort = options.reasoningEffort || config.imageModels?.reasoningEffort || "medium";
  let text = "";
  let mode = "structured-output";
  try {
    text = await requestJson({ oauthUrl, model, messages: input.messages, timeoutMs, structured: true, reasoningEffort });
  } catch (err) {
    if (err.code !== "PLANNER_UPSTREAM_FAILED") throw err;
    mode = "json-mode";
    text = await requestChatJson({ oauthUrl, model, messages: input.messages, timeoutMs });
  }
  try {
    return { output: JSON.parse(text), mode, model };
  } catch {
    throw plannerError("Planner returned invalid JSON", "PLANNER_INVALID_JSON", 502);
  }
}
