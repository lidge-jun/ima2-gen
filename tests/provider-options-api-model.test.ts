import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { config } from "../config.js";
import { resolveProviderOptions } from "../lib/providerOptions.ts";
import { createTestRuntimeContext } from "../lib/runtimeContext.ts";

function ctxWithApiDefaults(defaultImageModel = "gpt-image-2") {
  return createTestRuntimeContext({
    config: {
      ...config,
      apiProvider: {
        ...config.apiProvider,
        defaultImageModel,
      },
    },
  });
}

describe("API provider image model normalization", () => {
  it("allows OpenAI image model names that OAuth does not whitelist", () => {
    const result = resolveProviderOptions(ctxWithApiDefaults(), {
      provider: "api",
      rawModel: "gpt-image-2-2026-04-21",
    });

    assert.equal(result.provider, "api");
    assert.equal(result.model, "gpt-image-2-2026-04-21");
  });

  it("allows gateway-specific API image model names", () => {
    const result = resolveProviderOptions(ctxWithApiDefaults(), {
      provider: "api",
      rawModel: "my-proxy-image-model",
    });

    assert.equal(result.provider, "api");
    assert.equal(result.model, "my-proxy-image-model");
  });

  it("uses the API provider default image model without OAuth whitelist validation", () => {
    const result = resolveProviderOptions(ctxWithApiDefaults("gpt-image-1.5"), {
      provider: "api",
    });

    assert.equal(result.provider, "api");
    assert.equal(result.model, "gpt-image-1.5");
  });

  it("rejects invalid API image model strings", () => {
    const result = resolveProviderOptions(ctxWithApiDefaults(), {
      provider: "api",
      rawModel: "bad\nmodel",
    });

    assert.equal(result.code, "INVALID_API_IMAGE_MODEL");
    assert.equal(result.status, 400);
  });

  it("keeps OAuth image models on the strict whitelist", () => {
    const result = resolveProviderOptions(ctxWithApiDefaults(), {
      provider: "oauth",
      rawModel: "my-proxy-image-model",
    });

    assert.equal(result.code, "INVALID_IMAGE_MODEL");
    assert.equal(result.status, 400);
  });
});
