import { parseArgs } from "../lib/args.js";
import { resolveServer, request } from "../lib/client.js";
import { fileToDataUri, dataUriToFile, defaultOutName } from "../lib/files.js";
import { out, die, dieWithError, color, json } from "../lib/output.js";
import { config } from "../../config.js";

const VALID_MODES = new Set(["auto", "direct"]);
const VALID_MODERATION = new Set(["auto", "low"]);
const KNOWN_IMAGE_MODELS = new Set(["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex-spark"]);

const SPEC = {
  flags: {
    prompt:  { short: "p", type: "string" },
    quality: { short: "q", type: "string", default: "low" },
    size:    { short: "s", type: "string", default: "1024x1024" },
    out:     { short: "o", type: "string" },
    json:    {              type: "boolean" },
    timeout: {              type: "string", default: "180" },
    server:  {              type: "string" },
    model:   {              type: "string" },
    mode:    {              type: "string", default: "auto" },
    moderation: {            type: "string", default: "low" },
    session: {              type: "string" },
    "reasoning-effort": {  type: "string" },
    "web-search":      {  type: "boolean" },
    "no-web-search":   {  type: "boolean" },
    help:    { short: "h", type: "boolean" },
  },
};

const HELP = `
  ima2 edit <file> --prompt "<text>" [options]

  Edit an existing image (inpainting-style).

  Options:
    -p, --prompt <text>        Edit instruction (required)
    -q, --quality <low|medium|high>
    -s, --size <WxH>
    -o, --out <file>
        --json
        --model <gpt-5.5|gpt-5.4|gpt-5.4-mini>
        --mode <auto|direct>       Prompt handling mode. Default: auto
        --moderation <auto|low>    Default: low
        --session <id>             Apply session style sheet if enabled
        --reasoning-effort <none|low|medium|high|xhigh>
        --web-search / --no-web-search    Override default web-search toggle
`;

export default async function editCmd(argv) {
  const args = parseArgs(argv, SPEC);
  if (args.help) { out(HELP); return; }
  const input = args.positional[0];
  if (!input) die(2, "input image path required");
  if (!args.prompt) die(2, "--prompt is required");
  if (!VALID_MODES.has(args.mode)) die(2, "--mode must be one of: auto, direct");
  if (!VALID_MODERATION.has(args.moderation)) die(2, "--moderation must be one of: auto, low");
  if (args.model && !KNOWN_IMAGE_MODELS.has(args.model)) {
    die(2, "--model must be one of: gpt-5.5, gpt-5.4, gpt-5.4-mini, gpt-5.3-codex-spark");
  }
  const VALID_REASONING = new Set(["none", "low", "medium", "high", "xhigh"]);
  if (args["reasoning-effort"] && !VALID_REASONING.has(args["reasoning-effort"])) {
    die(2, "--reasoning-effort must be one of: none, low, medium, high, xhigh");
  }
  if (args["web-search"] && args["no-web-search"]) {
    die(2, "--web-search and --no-web-search are mutually exclusive");
  }

  let server;
  try { server = await resolveServer({ serverFlag: args.server }); }
  catch (e) {
    if (args.json) json({ ok: false, error: e.message, code: e.code, status: e.status });
    dieWithError(e);
  }

  const imageDataUri = await fileToDataUri(input);
  const imageB64 = imageDataUri.split(",")[1];

  const timeoutMs = (parseInt(args.timeout) || 180) * 1000;
  let resp;
  try {
    const editBody: any = {
      prompt: args.prompt,
      image: imageB64,
      quality: args.quality,
      size: args.size,
      model: args.model,
      mode: args.mode,
      moderation: args.moderation,
      sessionId: args.session,
    };
    if (args["reasoning-effort"]) editBody.reasoningEffort = args["reasoning-effort"];
    if (args["no-web-search"]) editBody.webSearchEnabled = false;
    else if (args["web-search"]) editBody.webSearchEnabled = true;
    resp = await request(server.base, "/api/edit", {
      method: "POST",
      body: editBody,
      timeoutMs,
    });
  } catch (e) {
    if (args.json) json({ ok: false, error: e.message, code: e.code });
    dieWithError(e);
  }

  const image = resp.image;
  if (!image) die(1, "server returned no image");
  const target = args.out || `${config.storage.generatedDir}/${defaultOutName(0, 1)}`;
  await dataUriToFile(image, target);

  if (args.json) {
    json({ ok: true, path: target, requestId: resp.requestId, elapsed: resp.elapsed });
  } else {
    out(color.green("✓ ") + target);
    if (resp.elapsed) out(color.dim(`elapsed ${resp.elapsed}s`));
  }
}
