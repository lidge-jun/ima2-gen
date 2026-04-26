import { parseArgs } from "../lib/args.js";
import { resolveServer, request } from "../lib/client.js";
import { fileToDataUri, dataUriToFile, defaultOutName } from "../lib/files.js";
import { out, die, dieWithError, color, json, exitCodeForError } from "../lib/output.js";

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

  let server;
  try { server = await resolveServer({ serverFlag: args.server }); }
  catch (e) { die(exitCodeForError(e), e.message); }

  const imageDataUri = await fileToDataUri(input);
  const imageB64 = imageDataUri.split(",")[1];

  const timeoutMs = (parseInt(args.timeout) || 180) * 1000;
  let resp;
  try {
    resp = await request(server.base, "/api/edit", {
      method: "POST",
      body: {
        prompt: args.prompt,
        image: imageB64,
        quality: args.quality,
        size: args.size,
        model: args.model,
        mode: args.mode,
        moderation: args.moderation,
        sessionId: args.session,
      },
      timeoutMs,
    });
  } catch (e) {
    if (args.json) json({ ok: false, error: e.message, code: e.code });
    dieWithError(e);
  }

  const image = resp.image;
  if (!image) die(1, "server returned no image");
  const target = args.out || defaultOutName(0, 1);
  await dataUriToFile(image, target);

  if (args.json) {
    json({ ok: true, path: target, requestId: resp.requestId, elapsed: resp.elapsed });
  } else {
    out(color.green("✓ ") + target);
    if (resp.elapsed) out(color.dim(`elapsed ${resp.elapsed}s`));
  }
}
