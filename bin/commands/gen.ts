import { parseArgs } from "../lib/args.js";
import { resolveServer, request, normalizeGenerate } from "../lib/client.js";
import { fileToDataUri, dataUriToFile, defaultOutName, readStdin } from "../lib/files.js";
import { out, die, dieWithError, color, json } from "../lib/output.js";
import { config } from "../../config.js";
import { createCliRequestId, recoverGeneratedOutputs, formatRecoveryHint } from "../lib/recover-output.js";

import { errInfo } from "../../lib/errInfo.js";
const VALID_MODES = new Set(["auto", "direct"]);
const VALID_MODERATION = new Set(["auto", "low"]);
const VALID_PROVIDERS = new Set(["auto", "oauth", "api", "grok", "grok-api", "agy", "gemini-api", "atlascloud"]);
const KNOWN_IMAGE_MODELS = new Set(["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna", "gpt-5.3-codex-spark", "grok-imagine-image", "grok-imagine-image-quality", "nano-banana-2", "nano-banana-pro", "openai/gpt-image-2/text-to-image", "openai/gpt-image-2/edit"]);
const MAX_GENERATION_COUNT = Math.max(1, Math.trunc(Number(config.limits.maxGeneratedImages) || 24));
const MAX_REFERENCE_COUNT = Math.max(1, Math.trunc(Number(config.limits.maxRefCount) || 5));

const SPEC = {
  flags: {
    quality:   { short: "q", type: "string", default: "low" },
    size:      { short: "s", type: "string", default: "1024x1024" },
    count:     { short: "n", type: "string", default: "1" },
    ref:       {              type: "string", repeatable: true },
    out:       { short: "o", type: "string" },
    "out-dir": { short: "d", type: "string" },
    json:      {              type: "boolean" },
    "no-save": {              type: "boolean" },
    force:     {              type: "boolean" },
    stdin:     {              type: "boolean" },
    timeout:   {              type: "string", default: "180" },
    server:    {              type: "string" },
    model:     {              type: "string" },
    provider:  {              type: "string" },
    mode:      {              type: "string", default: "auto" },
    moderation: {              type: "string", default: "low" },
    session:   {              type: "string" },
    "reasoning-effort": {     type: "string" },
    "web-search":      {     type: "boolean" },
    "no-web-search":   {     type: "boolean" },
    help:      { short: "h", type: "boolean" },
  },
};

const HELP = `
  ima2 gen <prompt...> [options]

  Generate image(s) via the running ima2 server.

  Batch/async note:
    Use -n <N> for multiple candidates in one request. Independent CLI
    commands can run concurrently against the server; monitor active requestIds
    with 'ima2 ps --json' and stop one with 'ima2 cancel <requestId>'.

  Options:
    -q, --quality <low|medium|high>         Default: low
    -s, --size <WxH | auto>                 Default: 1024x1024
    -n, --count <1..${MAX_GENERATION_COUNT}>                     Default: 1
        --ref <file>                        Attach reference image (repeatable, max ${MAX_REFERENCE_COUNT})
    -o, --out <file>                        Single-image output path (implies -n 1)
    -d, --out-dir <dir>                     Output dir for multiple images
        --json                              Print JSON result to stdout
        --no-save                           Skip save; print b64 to stdout (use --force for TTY)
        --stdin                              Read prompt from stdin
        --timeout <sec>                     Default: 180
        --server <url>                      Override server URL
        --model <gpt-5.5|gpt-5.4|gpt-5.4-mini|gpt-5.6-sol|gpt-5.6-terra|gpt-5.6-luna|grok-imagine-image|grok-imagine-image-quality|nano-banana-2|nano-banana-pro|openai/gpt-image-2/text-to-image|openai/gpt-image-2/edit>
        --provider <auto|oauth|api|grok|grok-api|agy|gemini-api|atlascloud>
                                            Provider (oauth = GPT OAuth; grok = xAI Grok; agy/gemini-api = Gemini; atlascloud = Atlas Cloud)
        --mode <auto|direct>                Prompt handling mode. Default: auto
        --moderation <auto|low>             Default: low
        --session <id>                      Apply session style sheet if enabled
        --reasoning-effort <none|low|medium|high|xhigh|max>
                                            Override server's reasoning effort
        --web-search / --no-web-search      Override default web-search toggle

  Examples:
    ima2 gen "a shiba in space"
    ima2 gen "a shiba in space" -n 4 -d ./out
    ima2 gen "poster" --model gpt-5.4 --mode direct --moderation low
    ima2 gen "merge" --ref a.png --ref b.png -q high -o out.png
    cat prompt.txt | ima2 gen --stdin -n 2 -d ./out
`;

export default async function genCmd(argv: string[]) {
  const args = parseArgs(argv, SPEC);
  if (args.help) { out(HELP); return; }

  let prompt = args.positional.join(" ");
  if (args.stdin) {
    const piped = await readStdin();
    if (piped) prompt = prompt ? `${prompt} ${piped}` : piped;
  }
  if (!prompt) die(2, "prompt is required (positional or via --stdin)");

  const refs = (Array.isArray(args.ref) ? args.ref : []) as string[];
  if (refs.length > MAX_REFERENCE_COUNT) die(2, `max ${MAX_REFERENCE_COUNT} --ref attachments`);
  if (!VALID_MODES.has(String(args.mode))) die(2, "--mode must be one of: auto, direct");
  if (!VALID_MODERATION.has(String(args.moderation))) die(2, "--moderation must be one of: auto, low");
  if (args.provider && !VALID_PROVIDERS.has(String(args.provider))) {
    die(2, "--provider must be one of: auto, oauth, api, grok, grok-api, agy, gemini-api, atlascloud");
  }
  if (args.model && !KNOWN_IMAGE_MODELS.has(String(args.model))) {
    die(2, "--model must be one of: gpt-5.5, gpt-5.4, gpt-5.4-mini, gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna, gpt-5.3-codex-spark, grok-imagine-image, grok-imagine-image-quality, nano-banana-2, nano-banana-pro, openai/gpt-image-2/text-to-image, openai/gpt-image-2/edit");
  }
  const VALID_REASONING = new Set(["none", "low", "medium", "high", "xhigh", "max"]);
  if (args["reasoning-effort"] && !VALID_REASONING.has(String(args["reasoning-effort"]))) {
    die(2, "--reasoning-effort must be one of: none, low, medium, high, xhigh, max");
  }
  if (args["web-search"] && args["no-web-search"]) {
    die(2, "--web-search and --no-web-search are mutually exclusive");
  }

  const n = Math.max(1, Math.min(MAX_GENERATION_COUNT, parseInt(String(args.count)) || 1));
  const timeoutMs = (parseInt(String(args.timeout)) || 180) * 1000;

  let server;
  try {
    server = await resolveServer({ serverFlag: args.server });
  } catch (e) {
    const err = errInfo(e);
    if (args.json) json({ ok: false, error: err.message, code: err.code, status: err.status });
    dieWithError(e);
  }

  const references = await Promise.all(refs.map((p: string) => fileToDataUri(p)));

  const outDir = args["out-dir"] ? String(args["out-dir"]) : null;
  const explicitOut = args.out ? String(args.out) : null;
  const requestId = createCliRequestId("req_cli_gen");

  const body: any = {
    prompt,
    quality: args.quality,
    size: args.size,
    n,
    references,
    model: args.model,
    mode: args.mode,
    moderation: args.moderation,
    sessionId: args.session,
    requestId,
  };
  if (args["reasoning-effort"]) body.reasoningEffort = args["reasoning-effort"];
  if (args.provider) body.provider = args.provider;
  if (args["no-web-search"]) body.webSearchEnabled = false;
  else if (args["web-search"]) body.webSearchEnabled = true;

  let resp;
  try {
    resp = await request(server.base, "/api/generate", {
      method: "POST",
      body,
      timeoutMs,
      headers: { "X-Request-Id": requestId },
    });
  } catch (e) {
    const err = errInfo(e);
    const isTimeout = err.name === "TimeoutError" || err.name === "AbortError";
    if (isTimeout && (explicitOut || outDir)) {
      const result = await recoverGeneratedOutputs(server.base, requestId, {
        explicitOut,
        outDir,
        expectedCount: n,
        json: Boolean(args.json),
      });
      if (result.recovered) {
        if (args.json) {
          json({ ok: true, requestId, recovered: true, images: result.paths.map((p) => ({ path: p })) });
        } else {
          out(formatRecoveryHint(result));
          for (const p of result.paths) out(color.green("✓ ") + p + color.dim(" (recovered)"));
        }
        return;
      }
      if (!args.json) out(formatRecoveryHint(result));
    }
    if (args.json) json({ ok: false, error: err.message, code: err.code, status: err.status, requestId });
    dieWithError(e);
  }

  const norm = normalizeGenerate(resp);
  if (norm.images.length === 0) die(1, "server returned no images");

  // --no-save path
  if (args["no-save"]) {
    const totalBytes = norm.images.reduce((s: number, im) => s + (im.image?.length ?? 0), 0);
    if (process.stdout.isTTY && totalBytes > 2 * 1024 * 1024 && !args.force) {
      die(2, "refusing to print >2MB of b64 to TTY; use --force or drop --no-save");
    }
    for (const im of norm.images) out(im.image);
    return;
  }

  // Save path
  if (explicitOut && norm.images.length > 1) {
    die(2, "--out only supports a single image; use --out-dir for n>1");
  }

  const savedPaths: string[] = [];
  for (let i = 0; i < norm.images.length; i++) {
    const im = norm.images[i];
    let target: string;
    if (explicitOut) {
      target = explicitOut;
    } else if (outDir) {
      target = `${outDir}/${defaultOutName(i, norm.images.length)}`;
    } else {
      target = `${config.storage.generatedDir}/${defaultOutName(i, norm.images.length)}`;
    }
    await dataUriToFile(String(im.image), target);
    savedPaths.push(target);
  }

  if (args.json) {
    json({
      ok: true,
      requestId: norm.requestId,
      elapsed: norm.elapsed,
      images: savedPaths.map((p, i) => ({ path: p, filename: norm.images[i].filename })),
    });
  } else {
    for (const p of savedPaths) out(color.green("✓ ") + p);
    if (norm.elapsed) out(color.dim(`elapsed ${norm.elapsed}s`));
  }
}
