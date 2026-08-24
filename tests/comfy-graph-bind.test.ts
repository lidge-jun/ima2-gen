import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  bindGraph,
  deriveParams,
  inferComfyMediaKind,
  inferBindCandidates,
  parseApiGraph,
  unambiguousBindings,
} from "../lib/comfyGraphBind.ts";
import { extractComfyApiGraph, readPngTextChunks } from "../lib/comfyPngWorkflow.ts";
import type { ComfyWorkflowBindings } from "../lib/comfyWorkflowStore.ts";

/**
 * Assert on `code`, not `instanceof`.
 *
 * The suite loads .ts sources while those sources import their .js build
 * siblings, so ComfyWorkflowError exists as two distinct classes at runtime and
 * instanceof is false across the boundary. The repo's other adapter tests
 * (tests/minimax-provider-contract.test.ts) check `err?.code` for the same
 * reason, and code is the field production callers branch on anyway.
 */
function hasCode(code: string, pattern?: RegExp) {
  return (error: unknown): boolean => {
    const candidate = error as { code?: unknown; message?: unknown };
    if (candidate?.code !== code) return false;
    return pattern ? pattern.test(String(candidate.message ?? "")) : true;
  };
}

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * The 7-node SDXL graph actually executed against ComfyUI 0.27.0 on
 * 2026-08-23, trimmed to the fields these assertions read. Two CLIPTextEncode
 * nodes is the normal shape, and it is the case ambiguity detection exists for.
 */
const LIVE_GRAPH = {
  "3": { class_type: "KSampler", inputs: { seed: 123456, steps: 8, cfg: 2.0, model: ["4", 0], positive: ["6", 0], negative: ["7", 0], latent_image: ["5", 0] } },
  "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "rinFlanimeIllustrious_v30.safetensors" } },
  "5": { class_type: "EmptyLatentImage", inputs: { width: 768, height: 768, batch_size: 1 } },
  "6": { class_type: "CLIPTextEncode", inputs: { text: "a calm orange tabby cat", clip: ["4", 1] }, _meta: { title: "CLIP Text Encode (Prompt)" } },
  "7": { class_type: "CLIPTextEncode", inputs: { text: "blurry, lowres", clip: ["4", 1] }, _meta: { title: "CLIP Text Encode (Negative)" } },
  "8": { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["4", 2] } },
  "9": { class_type: "SaveImage", inputs: { filename_prefix: "ima2_probe", images: ["8", 0] } },
};

const BIND: ComfyWorkflowBindings = {
  prompt: { node: "6", input: "text" },
  negativePrompt: { node: "7", input: "text" },
  width: { node: "5", input: "width" },
  height: { node: "5", input: "height" },
  seed: { node: "3", input: "seed" },
  output: { node: "9" },
};

const H3_GRAPH = {
  "129": { class_type: "RandomNoise", inputs: { noise_seed: 42 } },
  "131": { class_type: "MiniMaxH3ImageToVideo", inputs: { prompt: "waves", width: 864, height: 480, length: 243 } },
  "92": { class_type: "SaveVideo", inputs: { video: ["130", 0], filename_prefix: "video/h3" } },
};

describe("comfy graph parsing", () => {
  it("accepts an API-format export", () => {
    const graph = parseApiGraph(LIVE_GRAPH);
    assert.deepEqual(Object.keys(graph).sort(), ["3", "4", "5", "6", "7", "8", "9"]);
    assert.equal(graph["9"]!.class_type, "SaveImage");
  });

  it("accepts a JSON string as well as an object", () => {
    const graph = parseApiGraph(JSON.stringify(LIVE_GRAPH));
    assert.equal(graph["3"]!.class_type, "KSampler");
  });

  it("rejects a UI workflow save with an actionable message", () => {
    // The LiteGraph save format POST /prompt refuses. Catching it here is the
    // difference between "Export (API)" and an opaque upstream 400.
    const uiSave = { nodes: [{ id: 3, type: "KSampler" }], links: [], version: 0.4 };
    assert.throws(
      () => parseApiGraph(uiSave),
      hasCode("COMFY_WORKFLOW_GRAPH_INVALID", /Export \(API\)/),
    );
  });

  it("rejects a graph with no class_type nodes", () => {
    assert.throws(() => parseApiGraph({ a: { inputs: {} } }), hasCode("COMFY_WORKFLOW_GRAPH_INVALID"));
  });
});

describe("comfy binding inference", () => {
  it("infers H3 scalar bindings, SaveVideo output, and video media kind", () => {
    const graph = parseApiGraph(H3_GRAPH);
    const candidates = inferBindCandidates(graph);
    for (const [field, node, input] of [
      ["prompt", "131", "prompt"], ["width", "131", "width"],
      ["height", "131", "height"], ["seed", "129", "noise_seed"],
      ["output", "92", ""],
    ]) {
      assert.ok(candidates.some((candidate) => candidate.field === field && candidate.node === node && candidate.input === input && candidate.unambiguous));
    }
    assert.equal(inferComfyMediaKind(graph), "video");
    assert.equal(inferComfyMediaKind(graph, "92"), "video");
  });

  it("keeps output kind ambiguous when both image and video savers exist", () => {
    const graph = parseApiGraph({ ...H3_GRAPH, "93": { class_type: "SaveImage", inputs: { images: ["1", 0] } } });
    const outputs = inferBindCandidates(graph).filter((candidate) => candidate.field === "output");
    assert.equal(outputs.length, 2);
    assert.ok(outputs.every((candidate) => !candidate.unambiguous));
    assert.equal(inferComfyMediaKind(graph), undefined);
  });

  it("marks single-match fields unambiguous and CLIPTextEncode ambiguous", () => {
    const candidates = inferBindCandidates(parseApiGraph(LIVE_GRAPH));
    const prompts = candidates.filter((c) => c.field === "prompt");
    assert.equal(prompts.length, 2, "both CLIPTextEncode nodes are candidates");
    // Titles say "Prompt" and "Negative", and that is still not enough: a title
    // is user-editable free text, so a human confirms.
    assert.ok(prompts.every((c) => c.unambiguous === false));

    const seed = candidates.find((c) => c.field === "seed");
    assert.ok(seed?.unambiguous, "one KSampler means seed is decidable");
    assert.equal(seed?.node, "3");

    const output = candidates.find((c) => c.field === "output");
    assert.ok(output?.unambiguous);
    assert.equal(output?.node, "9");
  });

  it("omits ambiguous fields from the auto-accepted set", () => {
    const bind = unambiguousBindings(inferBindCandidates(parseApiGraph(LIVE_GRAPH)));
    assert.equal(bind.prompt, undefined, "prompt must be confirmed by a human");
    assert.deepEqual(bind.seed, { node: "3", input: "seed" });
    assert.deepEqual(bind.output, { node: "9" });
  });

  it("skips inputs that are node links rather than values", () => {
    // "images" on SaveImage is ["8", 0] wiring; it must never become a knob.
    const params = deriveParams(parseApiGraph(LIVE_GRAPH), BIND);
    assert.ok(!params.some((p) => p.input === "images"));
    assert.ok(!params.some((p) => p.input === "model"));
    assert.ok(params.some((p) => p.node === "3" && p.input === "steps"));
    assert.ok(params.some((p) => p.node === "4" && p.input === "ckpt_name"));
  });

  it("excludes already-bound inputs from the parameter contract", () => {
    const params = deriveParams(parseApiGraph(LIVE_GRAPH), BIND);
    assert.ok(!params.some((p) => p.node === "3" && p.input === "seed"));
    assert.ok(!params.some((p) => p.node === "5" && p.input === "width"));
    assert.ok(!params.some((p) => p.node === "6" && p.input === "text"));
  });
});

describe("comfy graph binding", () => {
  it("injects values without mutating the stored graph", () => {
    const graph = parseApiGraph(LIVE_GRAPH);
    const bound = bindGraph(graph, BIND, { prompt: "a red bicycle", seed: 42, width: 1024, height: 512 });
    assert.equal(bound["6"]!.inputs.text, "a red bicycle");
    assert.equal(bound["3"]!.inputs.seed, 42);
    assert.equal(bound["5"]!.inputs.width, 1024);
    // The stored copy is untouched, or the next generation inherits this prompt.
    assert.equal(graph["6"]!.inputs.text, "a calm orange tabby cat");
    assert.equal(graph["3"]!.inputs.seed, 123456);
  });

  it("applies declared params and ignores unknown ones", () => {
    const graph = parseApiGraph(LIVE_GRAPH);
    const params = deriveParams(graph, BIND);
    const bound = bindGraph(graph, BIND, { prompt: "x", params: { "KSampler.steps": 30, "Nope.nope": 1 } }, params);
    assert.equal(bound["3"]!.inputs.steps, 30);
  });

  it("fails when a binding points at a missing node", () => {
    const graph = parseApiGraph(LIVE_GRAPH);
    const stale: ComfyWorkflowBindings = { ...BIND, prompt: { node: "99", input: "text" } };
    assert.throws(() => bindGraph(graph, stale, { prompt: "x" }), hasCode("COMFY_WORKFLOW_BIND_INVALID"));
  });

  it("refuses a reference image when the workflow has no refImage binding", () => {
    const graph = parseApiGraph(LIVE_GRAPH);
    assert.throws(
      () => bindGraph(graph, BIND, { prompt: "x", refImageName: "up.png" }),
      hasCode("COMFY_WORKFLOW_BIND_INVALID"),
    );
  });
});

describe("comfy PNG metadata", () => {
  // Not a synthesized fixture: this is the file ComfyUI 0.27.0 returned from
  // /view during the 2026-08-23 live probe recorded in 001.
  const livePng = join(repoRoot, "devlog/_plan/260823_comfy_provider_lane/evidence/001_live_generate_768.png");

  it("reads the API graph out of a real ComfyUI PNG", () => {
    const buffer = readFileSync(livePng);
    const chunks = readPngTextChunks(buffer);
    assert.ok(chunks.has("prompt"), "ComfyUI writes the API graph under 'prompt'");

    const graph = extractComfyApiGraph(buffer);
    assert.ok(graph);
    assert.deepEqual(Object.keys(graph!).sort(), ["3", "4", "5", "6", "7", "8", "9"]);
    assert.equal(graph!["9"]!.class_type, "SaveImage");
    assert.match(String(graph!["6"]!.inputs.text), /orange tabby cat/);
  });

  it("returns null for a PNG with no ComfyUI metadata", () => {
    // Minimal PNG: signature + IHDR + IEND, no text chunks.
    const ihdr = Buffer.alloc(25);
    Buffer.from("89504e470d0a1a0a", "hex").copy(ihdr, 0);
    ihdr.writeUInt32BE(13, 8);
    ihdr.write("IHDR", 12, "latin1");
    const iend = Buffer.alloc(12);
    iend.writeUInt32BE(0, 0);
    iend.write("IEND", 4, "latin1");
    assert.equal(extractComfyApiGraph(Buffer.concat([ihdr, iend])), null);
  });

  it("returns an empty map for a non-PNG buffer", () => {
    assert.equal(readPngTextChunks(Buffer.from("not a png")).size, 0);
  });
});
