import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_IMAGE_MODEL,
  resolveCoreModelValue,
  COMFY_VIDEO_VALUE_PREFIX,
  VIDEO_VALUE_PREFIX,
} from "../ui/src/lib/imageModels.ts";

function readSource(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const base = {
  imageModel: DEFAULT_IMAGE_MODEL,
  videoModel: false as string | false,
  comfyVideoWorkflow: null as string | null,
};

// The model Select finds its trigger label by matching the selected value
// against the option rows it rendered. A value no row carries produces an EMPTY
// label, so the control names its lane ("GPT") and then names no model at all —
// the reported bug. These are value assertions rather than source regexes
// because a source match would still pass if the returned value were wrong.
describe("model select value: lane gating", () => {
  it("ignores a comfy video workflow stranded outside the comfy lane", () => {
    // Reported state: the user is on GPT with luna selected, but a comfy video
    // workflow chosen earlier is still in the store, and used to win outright.
    for (const provider of ["oauth", "api", "grok", "gemini-api", "nai"] as const) {
      assert.equal(
        resolveCoreModelValue({ ...base, provider, comfyVideoWorkflow: "wf-anim-1" }),
        DEFAULT_IMAGE_MODEL,
        `${provider} must not display a comfy workflow`,
      );
    }
  });

  it("ignores a stale grok video model outside the grok lanes", () => {
    // Same failure shape, different carrier: video rows are only rendered for
    // the grok lanes, so a leftover video selection is equally unmatched.
    for (const provider of ["oauth", "api", "gemini-api", "comfy"] as const) {
      assert.equal(
        resolveCoreModelValue({ ...base, provider, videoModel: "grok-imagine-video-1.5" }),
        DEFAULT_IMAGE_MODEL,
        `${provider} must not display a grok video model`,
      );
    }
  });

  it("still shows each lane its own selection", () => {
    assert.equal(
      resolveCoreModelValue({ ...base, provider: "comfy", comfyVideoWorkflow: "wf-anim-1" }),
      `${COMFY_VIDEO_VALUE_PREFIX}wf-anim-1`,
    );
    assert.equal(
      resolveCoreModelValue({ ...base, provider: "grok", videoModel: "grok-imagine-video-1.5" }),
      `${VIDEO_VALUE_PREFIX}grok-imagine-video-1.5`,
    );
    assert.equal(
      resolveCoreModelValue({ ...base, provider: "grok-api", videoModel: "grok-imagine-video" }),
      `${VIDEO_VALUE_PREFIX}grok-imagine-video`,
    );
  });

  it("falls back to the image model when a lane has no lane-specific selection", () => {
    assert.equal(resolveCoreModelValue({ ...base, provider: "comfy" }), DEFAULT_IMAGE_MODEL);
    assert.equal(resolveCoreModelValue({ ...base, provider: "grok" }), DEFAULT_IMAGE_MODEL);
    assert.equal(resolveCoreModelValue({ ...base, provider: "oauth" }), DEFAULT_IMAGE_MODEL);
  });

  it("accepts the undefined slices the persisted-defaults type allows", () => {
    assert.equal(
      resolveCoreModelValue({
        provider: "oauth",
        imageModel: DEFAULT_IMAGE_MODEL,
        videoModel: undefined,
        comfyVideoWorkflow: undefined,
      }),
      DEFAULT_IMAGE_MODEL,
    );
  });

  it("computes the displayed value through the shared resolver", () => {
    // Guards the wiring the value tests above cannot see: the component must
    // call the resolver instead of recomputing the precedence inline.
    const component = readSource("ui/src/components/GenProviderModelSelect.tsx");
    assert.match(component, /const coreModelValue = resolveCoreModelValue\(\{/);
    assert.doesNotMatch(component, /const coreModelValue = comfyVideoWorkflow/);
    // One source for the encodings, so an option row cannot drift off the value.
    assert.match(component, /const VIDEO_PREFIX = VIDEO_VALUE_PREFIX;/);
    assert.match(component, /const COMFY_VIDEO_PREFIX = COMFY_VIDEO_VALUE_PREFIX;/);
  });

  it("keeps a selection this lane no longer lists visible instead of blank", () => {
    // Lane gating cannot save a value that belongs to the CURRENT lane but has
    // disappeared from it: a deleted comfy workflow is still a legal
    // comfyVideoWorkflow and is persisted with no membership check, so the
    // trigger would go blank exactly like the original report. The component
    // adds a row for an unlisted value, the way the MCP branch already does.
    const component = readSource("ui/src/components/GenProviderModelSelect.tsx");
    assert.match(component, /const listedValues = new Set\(modelGroups\.flatMap\(/);
    assert.match(component, /if \(coreModelValue && !listedValues\.has\(coreModelValue\)\) \{/);
    assert.match(component, /modelGroups\.unshift\(\{/);
  });
});

describe("comfy lane exit: stranded selection cleanup", () => {
  const settings = readSource("ui/src/store/storeSettingsImpl.ts");

  it("clears comfy-only selections when leaving the comfy lane", () => {
    // The pre-existing branch only cleared on the way IN, so both carriers rode
    // out of the lane and produced the empty label under GPT.
    assert.match(settings, /if \(get\(\)\.provider === "comfy" && provider !== "comfy"\) \{/);
    assert.match(settings, /comfyWorkflow: null,\s*\n\s*comfyVideoWorkflow: null,/);
    assert.match(settings, /saveGenerationDefaultsPatch\(\{ comfyWorkflow: null, comfyVideoWorkflow: null \}\)/);
  });

  it("converges a workflow id left in imageModel by union membership", () => {
    // A workflow id matches none of the per-provider predicates below it, so
    // enumerating providers could never catch it; membership in the ImageModel
    // union can. Also persisted, or a reload would restore the default anyway
    // and hide the in-session bug rather than fix it.
    assert.match(settings, /const strandedModel = !isImageModel\(currentModel\);/);
    assert.match(settings, /if \(strandedModel\) saveImageModel\(DEFAULT_IMAGE_MODEL\);/);
    assert.match(settings, /\.\.\.\(strandedModel \? \{ imageModel: DEFAULT_IMAGE_MODEL \} : \{\}\)/);
  });

  it("keeps the 260823 contract: re-selecting comfy preserves the workflow", () => {
    // Clearing belongs to the outbound transition only. Re-entering the lane
    // already selected (or hydrating one) must not discard the user's choice.
    assert.match(settings, /if \(get\(\)\.provider === "comfy"\) set\(\{ provider \}\);/);
    assert.match(settings, /else set\(\{ provider, comfyWorkflow: null, comfyVideoWorkflow: null \}\);/);
  });
});
