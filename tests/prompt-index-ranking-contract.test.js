import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { listCuratedSources } from "../lib/promptImport/curatedSources.ts";
import { extractGptImageHints } from "../lib/promptImport/gptImageHints.ts";
import { rankPromptCandidates } from "../lib/promptImport/rankPromptCandidates.ts";

describe("prompt index ranking contract", () => {
  it("ships curated Nano Banana registry seeds without default manual-review search", () => {
    const sources = listCuratedSources();
    assert.ok(sources.some((source) => source.repo === "PicoTrex/Awesome-Nano-Banana-images"));
    assert.ok(sources.some((source) => source.repo === "aimikoda/nano-banana-pro-prompts"));
    assert.ok(sources.some((source) => source.repo === "yuyan124/awesome-stable-diffusion-prompts"));
    assert.ok(sources.some((source) => source.repo === "Dalabad/stable-diffusion-prompt-templates"));
    assert.ok(sources.some((source) => source.repo === "Ezagor-dev/awesome-midjourney-prompts"));
    assert.ok(sources.some((source) => source.repo === "danielrosehill/Tech-Diagram-Image-Gen-Prompts"));
    assert.ok(sources.every((source) => source.trustTier === "manual-review" || (source.owner && source.name)));

    const defaultSources = listCuratedSources({ includeManualReview: false, defaultSearchOnly: true });
    assert.ok(defaultSources.length >= 2);
    assert.ok(defaultSources.every((source) => source.trustTier !== "manual-review"));
    assert.ok(defaultSources.every((source) => source.defaultSearch));
  });

  it("extracts gpt-image-2 model hints and compatibility warnings", () => {
    const hints = extractGptImageHints(
      "Create a gpt-image-2 reference image edit with transparent background, readable typography, 4k layout.",
    );
    assert.ok(hints.modelHints.includes("gpt-image-2"));
    assert.ok(hints.taskHints.includes("reference-image"));
    assert.ok(hints.taskHints.includes("typography"));
    assert.ok(hints.sizeHints.includes("4k"));
    assert.ok(hints.warnings.includes("transparent-unsupported-gpt-image-2"));
  });

  it("ranks exact title, tag, and hint matches above weaker text matches", () => {
    const results = rankPromptCandidates({
      query: "gpt-image-2 typography",
      limit: 5,
      candidates: [
        {
          id: "weak",
          name: "General prompt",
          text: "A general prompt with typography mentioned once.",
          tags: [],
          scoreHints: {},
          warnings: [],
        },
        {
          id: "strong",
          name: "GPT Image 2 typography poster",
          text: "Build a strict poster layout.",
          tags: ["gpt-image-2", "trust:curated"],
          scoreHints: { modelHints: ["gpt-image-2"], taskHints: ["typography"] },
          warnings: [],
        },
      ],
    });
    assert.equal(results[0].id, "strong");
  });
});
