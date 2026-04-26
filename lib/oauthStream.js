// Shared SSE reader for the openai-oauth /v1/responses endpoint.
// Used by both generation and edit flows in server.js.

/**
 * POST a body to the OAuth proxy /v1/responses endpoint and collect
 * the generated image (+ usage + web_search count) from either the
 * streaming SSE response or a non-stream JSON response.
 *
 * @param {object} args
 * @param {string} args.url            - OAuth proxy base URL (no trailing slash)
 * @param {object} args.body           - JSON body to POST. `stream:true/false` is up to the caller.
 * @param {(phase: string) => void} [args.onPhase] - Called with "streaming" / "decoding" etc.
 * @param {(p: { b64: string, index: number|null, eventType: string }) => void} [args.onPartialImage]
 *   - Called for each partial image event the upstream emits (e.g. when
 *     `tools[].image_generation.partial_images` was set on the request body).
 *     The callback receives the raw base64 string, no data: prefix.
 * @returns {Promise<{ b64: string|null, usage: any, webSearchCalls: number, eventCount: number, raw?: any }>}
 */
export async function runResponses({ url, body, onPhase, onPartialImage }) {
  const res = await fetch(`${url}/v1/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: body?.stream ? "text/event-stream" : "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    let msg;
    try { msg = JSON.parse(text).error?.message; } catch {}
    const err = new Error(msg || `OAuth proxy returned ${res.status}: ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }

  const contentType = res.headers.get("content-type") || "";
  const isSSE = contentType.includes("text/event-stream");

  if (!isSSE) {
    const json = await res.json();
    let b64 = null;
    const textParts = [];
    for (const item of (json.output || [])) {
      if (item.type === "image_generation_call" && item.result) {
        b64 = item.result;
      } else if (item.type === "message" && Array.isArray(item.content)) {
        for (const c of item.content) {
          if (c?.type === "output_text" && typeof c.text === "string") {
            textParts.push(c.text);
          }
        }
      }
    }
    return {
      b64,
      text: textParts.length ? textParts.join("") : null,
      usage: json.usage || null,
      webSearchCalls: json.tool_usage?.web_search?.num_requests || 0,
      eventCount: 0,
      raw: json,
    };
  }

  onPhase?.("streaming");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let imageB64 = null;
  let usage = null;
  let webSearchCalls = 0;
  let eventCount = 0;
  const textParts = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      let eventData = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("data: ")) eventData += line.slice(6);
      }

      if (!eventData || eventData === "[DONE]") continue;

      try {
        const data = JSON.parse(eventData);
        eventCount++;

        // Partial image preview — upstream emits multiple of these when
        // `image_generation.partial_images` is requested. Field shape varies
        // by openai-oauth proxy version, so probe several known locations.
        if (typeof data.type === "string" && data.type.includes("partial")) {
          const item = data.item || {};
          const partialB64 =
            data.partial_image ||
            data.image ||
            data.result ||
            item.partial_image ||
            item.image ||
            item.result;
          if (typeof partialB64 === "string" && partialB64.length > 0) {
            const idx =
              Number.isFinite(data.index)
                ? data.index
                : Number.isFinite(item.index)
                  ? item.index
                  : null;
            try {
              onPartialImage?.({ b64: partialB64, index: idx, eventType: data.type });
            } catch {
              // Never let a UI handler throw kill the stream.
            }
          }
        }

        if (
          data.type === "response.output_item.done" &&
          data.item?.type === "image_generation_call" &&
          data.item.result
        ) {
          imageB64 = data.item.result;
          onPhase?.("decoding");
        }
        if (
          data.type === "response.output_item.done" &&
          data.item?.type === "web_search_call"
        ) {
          webSearchCalls += 1;
        }
        if (data.type === "response.output_text.done" && typeof data.text === "string") {
          textParts.push(data.text);
        }
        if (data.type === "response.completed") {
          usage = data.response?.usage || null;
          const wsNum = data.response?.tool_usage?.web_search?.num_requests;
          if (typeof wsNum === "number" && wsNum > webSearchCalls) {
            webSearchCalls = wsNum;
          }
        }
        if (data.type === "error") {
          throw new Error(data.error?.message || JSON.stringify(data));
        }
      } catch (e) {
        // JSON.parse errors on partial payloads are ignored; bubble up everything else.
        if (e.message && !e.message.startsWith("Unexpected")) throw e;
      }
    }
  }

  return {
    b64: imageB64,
    text: textParts.length ? textParts.join("") : null,
    usage,
    webSearchCalls,
    eventCount,
  };
}
