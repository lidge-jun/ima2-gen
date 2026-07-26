import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildGrokPlannerPayload,
  buildGrokSearchPayload,
  generateViaGrok,
  parseGrokImagePlan,
} from "../lib/grokImageAdapter.js";
import { generateMultimodeViaGrok } from "../lib/grokMultimodeAdapter.js";
import { config } from "../config.js";
import { DEFAULT_GROK_PLANNER_MODEL } from "../config.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function ctx(overrides: Record<string, unknown> = {}) {
  return {
    config: {
      ...config,
      grokProvider: {
        ...config.grokProvider,
        proxyHost: "127.0.0.1",
        proxyPort: 18645,
        plannerModel: "grok-4.3",
        plannerTimeoutMs: 10_000,
        generationTimeoutMs: 10_000,
      },
    },
    packageVersion: "test",
    ...overrides,
  } as any;
}

function plannerUserText(payload: ReturnType<typeof buildGrokPlannerPayload>): string {
  const content = payload.messages[1].content;
  if (typeof content === "string") return content;
  return content
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

describe("Grok planner adapter", () => {
  it("uses the current planner by default while preserving explicit compatibility overrides", () => {
    const sizeParams = { aspect_ratio: "1:1", resolution: "1k" } as const;
    assert.equal(
      buildGrokPlannerPayload("default", "grok-imagine-image-quality", "1024x1024", sizeParams).model,
      DEFAULT_GROK_PLANNER_MODEL,
    );
    assert.equal(buildGrokSearchPayload("default").model, DEFAULT_GROK_PLANNER_MODEL);
    assert.equal(buildGrokSearchPayload("compat", "grok-4.3").model, "grok-4.3");
  });

  it("builds a forced generate_image tool call payload", () => {
    const payload = buildGrokPlannerPayload(
      "make a poster",
      "grok-imagine-image-quality",
      "2048x1152",
      { aspect_ratio: "16:9", resolution: "2k" },
      "grok-4.3",
      "Search found current stage-lighting references.",
      [
        { b64: Buffer.from("ref-one").toString("base64"), detectedMime: "image/png" },
        { b64: Buffer.from("ref-two").toString("base64"), detectedMime: "image/jpeg" },
      ],
    );
    const userText = plannerUserText(payload);

    assert.equal(payload.model, "grok-4.3");
    assert.equal(payload.parallel_tool_calls, false);
    assert.deepEqual(payload.tool_choice, { type: "function", function: { name: "generate_image" } });
    assert.equal(payload.tools[0].function.name, "generate_image");
    assert.match(String(payload.messages[0].content), /MUST be in English/);
    assert.match(userText, /2048x1152/);
    assert.match(userText, /"aspect_ratio":"16:9"/);
    assert.match(userText, /Search found current/);
    assert.match(userText, /Reference images attached: 2/);
    assert.match(userText, /prompt argument in English only/);
    assert.equal(Array.isArray(payload.messages[1].content), true);
    assert.equal((payload.messages[1].content as any[]).filter((part) => part.type === "image_url").length, 2);
  });

  it("builds a mandatory web_search responses payload", () => {
    const payload = buildGrokSearchPayload("make a current poster", "grok-4.3");

    assert.equal(payload.model, "grok-4.3");
    assert.deepEqual(payload.tools, [{ type: "web_search" }]);
    assert.equal(payload.tool_choice, "required");
    assert.match(payload.input[0].content, /must use web_search/);
  });

  it("parses planner tool arguments", () => {
    const plan = parseGrokImagePlan({
      choices: [{
        message: {
          tool_calls: [{
            type: "function",
            function: {
              name: "generate_image",
              arguments: JSON.stringify({ prompt: "cinematic cat", model: "grok-imagine-image" }),
            },
          }],
        },
      }],
    }, "grok-imagine-image-quality");

    assert.deepEqual(plan, { prompt: "cinematic cat", model: "grok-imagine-image-quality", webSearchCalls: 1 });
  });

  it("runs mandatory search, planner, then images API without sending unsupported size", async () => {
    const calls: Array<{ url: string; body: any }> = [];
    globalThis.fetch = (async (url, init) => {
      const body = JSON.parse(String(init?.body || "{}"));
      calls.push({ url: String(url), body });
      if (String(url).endsWith("/v1/responses")) {
        return Response.json({
          output: [{
            type: "message",
            content: [{ type: "output_text", text: "Visual search brief with current references." }],
          }],
        });
      }
      if (String(url).endsWith("/v1/chat/completions")) {
        return Response.json({
          choices: [{
            message: {
              tool_calls: [{
                type: "function",
                function: {
                  name: "generate_image",
                  arguments: JSON.stringify({ prompt: "planned image prompt", model: "grok-imagine-image-quality" }),
                },
              }],
            },
          }],
        });
      }
      if (String(url).startsWith("https://cdn.x.ai/")) {
        return new Response(Buffer.from("jpeg"), { headers: { "Content-Type": "image/jpeg" } });
      }
      return Response.json({
        data: [{ url: "https://cdn.x.ai/test-gen.png" }],
        usage: { cost_in_usd_ticks: 400000000 },
      });
    }) as typeof fetch;

    const result = await generateViaGrok("raw prompt", ctx({
      grokActualPort: 18647,
      grokUrl: "http://127.0.0.1:18647/v1",
    }), {
      model: "grok-imagine-image-quality",
      size: "2048x1152",
      requestId: "req_test",
    });

    assert.equal(calls.length, 4);
    assert.equal(calls.slice(0, 3).every((call) => call.url.startsWith("http://127.0.0.1:18647/")), true);
    assert.equal(calls[0].url.endsWith("/v1/responses"), true);
    assert.equal(calls[0].body.tool_choice, "required");
    assert.equal(calls[1].body.model, "grok-4.3");
    assert.match(plannerUserText(calls[1].body), /Visual search brief/);
    assert.equal(calls[2].body.prompt, "planned image prompt");
    assert.equal(calls[2].body.aspect_ratio, "16:9");
    assert.equal(calls[2].body.resolution, "2k");
    assert.equal("size" in calls[2].body, false);
    assert.equal(result.revisedPrompt, "planned image prompt");
    assert.equal(result.webSearchCalls, 1);
    assert.equal(result.mime, "image/jpeg");
  });

  it("uses image edits endpoint when classic Grok generation has reference images", async () => {
    const calls: Array<{ url: string; body: any }> = [];
    globalThis.fetch = (async (url, init) => {
      const body = JSON.parse(String(init?.body || "{}"));
      calls.push({ url: String(url), body });
      if (String(url).endsWith("/v1/responses")) {
        return Response.json({
          output: [{
            type: "message",
            content: [{ type: "output_text", text: "Visual search brief for reference-based image editing." }],
          }],
        });
      }
      if (String(url).endsWith("/v1/chat/completions")) {
        return Response.json({
          choices: [{
            message: {
              tool_calls: [{
                type: "function",
                function: {
                  name: "generate_image",
                  arguments: JSON.stringify({ prompt: "planned edit prompt", model: "grok-imagine-image-quality" }),
                },
              }],
            },
          }],
        });
      }
      if (String(url).startsWith("https://cdn.x.ai/")) {
        return new Response(Buffer.from("png"), { headers: { "Content-Type": "image/png" } });
      }
      return Response.json({
        data: [{ url: "https://cdn.x.ai/test-edit.png" }],
      });
    }) as typeof fetch;

    const result = await generateViaGrok("raw prompt", ctx(), {
      model: "grok-imagine-image-quality",
      size: "2048x1152",
      requestId: "req_ref",
      references: [
        { b64: Buffer.from("ref-one").toString("base64"), detectedMime: "image/png" },
        { b64: Buffer.from("ref-two").toString("base64"), declaredMime: "image/jpeg" },
      ],
    });

    assert.equal(calls.length, 4);
    assert.equal(calls[2].url.endsWith("/v1/images/edits"), true);
    assert.equal(calls[2].body.prompt, "planned edit prompt");
    assert.equal(Array.isArray(calls[2].body.images), true);
    assert.equal(calls[2].body.images.length, 2);
    assert.match(calls[2].body.images[0].url, /^data:image\/png;base64,/);
    assert.match(calls[2].body.images[1].url, /^data:image\/jpeg;base64,/);
    assert.equal(calls[2].body.aspect_ratio, "16:9");
    assert.equal(calls[2].body.resolution, "2k");
    assert.equal("size" in calls[2].body, false);
    assert.match(plannerUserText(calls[1].body), /Reference images attached: 2/);
    assert.match(plannerUserText(calls[1].body), /prompt argument in English only/);
    assert.equal(calls[1].body.messages[1].content.filter((part: any) => part.type === "image_url").length, 2);
    assert.equal(result.revisedPrompt, "planned edit prompt");
    assert.equal(result.webSearchCalls, 1);
  });

  it("uses search, multimodal planner, and edits endpoint for Grok multimode references", async () => {
    const calls: Array<{ url: string; body: any }> = [];
    globalThis.fetch = (async (url, init) => {
      const body = JSON.parse(String(init?.body || "{}"));
      calls.push({ url: String(url), body });
      if (String(url).endsWith("/v1/responses")) {
        return Response.json({
          output: [{
            type: "message",
            content: [{ type: "output_text", text: "Visual search brief for multimode reference editing." }],
          }],
        });
      }
      if (String(url).endsWith("/v1/chat/completions")) {
        return Response.json({
          choices: [{
            message: {
              tool_calls: [{
                type: "function",
                function: {
                  name: "generate_image",
                  arguments: JSON.stringify({ prompt: "planned multimode edit prompt", model: "grok-imagine-image-quality" }),
                },
              }],
            },
          }],
        });
      }
      if (String(url).startsWith("https://cdn.x.ai/")) {
        return new Response(Buffer.from("multi-ref"), { headers: { "Content-Type": "image/jpeg" } });
      }
      return Response.json({
        data: [{ url: "https://cdn.x.ai/test-multi.png" }],
      });
    }) as typeof fetch;

    const result = await generateMultimodeViaGrok("raw sequence prompt", ctx(), {
      model: "grok-imagine-image-quality",
      size: "2048x1152",
      maxImages: 1,
      requestId: "req_multi_ref",
      references: [
        { b64: Buffer.from("ref-one").toString("base64"), detectedMime: "image/png" },
      ],
    });

    assert.equal(calls.length, 4);
    assert.equal(calls[0].url.endsWith("/v1/responses"), true);
    assert.equal(calls[1].url.endsWith("/v1/chat/completions"), true);
    assert.equal(calls[2].url.endsWith("/v1/images/edits"), true);
    assert.equal(calls[2].body.prompt, "planned multimode edit prompt");
    assert.match(calls[2].body.image.url, /^data:image\/png;base64,/);
    assert.equal(calls[2].body.aspect_ratio, "16:9");
    assert.equal(calls[2].body.resolution, "2k");
    assert.match(plannerUserText(calls[1].body), /Reference images attached: 1/);
    assert.equal(calls[1].body.messages[1].content.filter((part: any) => part.type === "image_url").length, 1);
    assert.equal(result.images.length, 1);
    assert.equal(result.images[0].revisedPrompt, "planned multimode edit prompt");
    assert.equal(result.webSearchCalls, 1);
  });
});
