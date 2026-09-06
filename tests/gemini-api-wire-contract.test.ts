import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { executionTestProcess } from "./_executionTestProcess.ts";
import { openGeminiFixture } from "./_geminiTransportFixture.ts";

function imageFormat(body: Record<string, unknown>): Record<string, unknown> {
  const config = body.generation_config as Record<string, unknown>;
  const format = config.response_format as Record<string, unknown> | undefined;
  return (format?.image ?? {}) as Record<string, unknown>;
}

// No static DUT import: config isolation and Vertex mock precede native imports.
if (executionTestProcess(import.meta.url)) describe("gemini-api public v1beta wire contract (070 QA regression)", () => {
  let fixture: Awaited<ReturnType<typeof openGeminiFixture>>;
  before(async () => { fixture = await openGeminiFixture(); });
  after(async () => { await fixture?.close(); });

  it("1024x1024 maps to v1beta enums, not human strings", async () => {
    await fixture.run("a teapot", { model: "nano-banana-2", size: "1024x1024" });
    const body = JSON.parse(fixture.calls.at(-1)!.body);
    assert.deepEqual(imageFormat(body), { aspect_ratio: "ASPECT_RATIO_ONE_BY_ONE", image_size: "IMAGE_SIZE_ONE_K" });
    assert.equal(fixture.vertex.tokenCalls, 0);
  });

  it("references add inlineData without changing the image config", async () => {
    const b64 = Buffer.from("ref").toString("base64");
    await fixture.run("same character", { model: "nano-banana-2", size: "1024x1024",
      references: [{ b64, declaredMime: "image/png" }] });
    const body = JSON.parse(fixture.calls.at(-1)!.body);
    assert.equal(imageFormat(body).aspect_ratio, "ASPECT_RATIO_ONE_BY_ONE");
    assert.deepEqual(body.contents, [{ role: "user", parts: [
      { inlineData: { data: b64, mimeType: "image/png" } }, { text: "same character" },
    ] }]);
    assert.equal(fixture.vertex.tokenCalls, 0);
  });

  it("auto size omits the image config entirely", async () => {
    await fixture.run("free ratio", { model: "nano-banana-2", size: "auto" });
    assert.deepEqual(JSON.parse(fixture.calls.at(-1)!.body).generation_config, { response_modalities: ["TEXT", "IMAGE"] });
  });

  it("ratio table maps every supported aspect to its enum", async () => {
    const cases = [
      ["1024x1024", "ONE_BY_ONE"], ["1024x1536", "TWO_BY_THREE"], ["1536x1024", "THREE_BY_TWO"],
      ["1152x1536", "THREE_BY_FOUR"], ["1365x1024", "FOUR_BY_THREE"],
      ["2048x1152", "SIXTEEN_BY_NINE"], ["1152x2048", "NINE_BY_SIXTEEN"],
      ["800x1000", "FOUR_BY_FIVE"], ["1000x800", "FIVE_BY_FOUR"], ["2100x900", "TWENTY_ONE_BY_NINE"],
      ["256x2048", "ONE_BY_EIGHT"], ["2048x256", "EIGHT_BY_ONE"],
      ["512x2048", "ONE_BY_FOUR"], ["2048x512", "FOUR_BY_ONE"],
    ];
    for (const [size, expected] of cases) {
      await fixture.run("ratio probe", { model: "nano-banana-2", size });
      assert.equal(imageFormat(JSON.parse(fixture.calls.at(-1)!.body)).aspect_ratio, `ASPECT_RATIO_${expected}`, size);
    }
  });
});
