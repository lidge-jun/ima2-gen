import { writeFile } from "fs/promises";
import { parseArgs } from "../lib/args.js";
import { resolveServer } from "../lib/client.js";
import { streamSse } from "../lib/sse.js";
import { dataUriToFile, defaultOutName } from "../lib/files.js";
import { out, die, color, json, exitCodeForError } from "../lib/output.js";
import { config } from "../../config.js";

const SPEC = {
  flags: {
    quality: { short: "q", type: "string", default: "low" },
    size:    { short: "s", type: "string", default: "1024x1024" },
    "max-images": { type: "string", default: "4" },
    out:     { short: "o", type: "string" },
    "out-dir": { short: "d", type: "string" },
    json:    { type: "boolean" },
    timeout: { type: "string", default: "600" },
    server:  { type: "string" },
    model:   { type: "string" },
    "reasoning-effort": { type: "string" },
    "web-search":    { type: "boolean" },
    "no-web-search": { type: "boolean" },
    moderation: { type: "string", default: "low" },
    session: { type: "string" },
    "show-partial": { type: "boolean" },
    help: { short: "h", type: "boolean" },
  },
};

const HELP = `
  ima2 multimode <prompt...> [options]

  Stream multi-image generation via SSE (phase / partial / image / done / error).

  Options:
    -q, --quality <low|medium|high>     Default: low
    -s, --size <WxH>                    Default: 1024x1024
        --max-images <1..8>             Default: 4
    -o, --out <file>                    First image (implies --max-images 1)
    -d, --out-dir <dir>                 Output dir for multiple images
        --json
        --model <gpt-5.5|gpt-5.4|gpt-5.4-mini>
        --reasoning-effort <none|low|medium|high|xhigh>
        --web-search / --no-web-search
        --moderation <auto|low>
        --session <id>
        --show-partial                  Print [partial #N received] notices
        --timeout <sec>                 Default: 600
`;

export default async function multimodeCmd(argv) {
  const args = parseArgs(argv, SPEC);
  if (args.help) { out(HELP); return; }
  const prompt = args.positional.join(" ");
  if (!prompt) die(2, "prompt required");

  const VALID_REASONING = new Set(["none", "low", "medium", "high", "xhigh"]);
  if (args["reasoning-effort"] && !VALID_REASONING.has(args["reasoning-effort"])) {
    die(2, "--reasoning-effort must be one of: none, low, medium, high, xhigh");
  }
  if (args["web-search"] && args["no-web-search"]) {
    die(2, "--web-search and --no-web-search are mutually exclusive");
  }

  let server;
  try { server = await resolveServer({ serverFlag: args.server }); }
  catch (e: any) { die(exitCodeForError(e), e.message); throw e; }

  const maxImages = Math.max(1, Math.min(8, parseInt(args["max-images"]) || 4));
  const body: any = {
    prompt,
    quality: args.quality,
    size: args.size,
    maxImages,
    moderation: args.moderation,
    sessionId: args.session,
  };
  if (args.model) body.model = args.model;
  if (args["reasoning-effort"]) body.reasoningEffort = args["reasoning-effort"];
  if (args["no-web-search"]) body.webSearchEnabled = false;
  else if (args["web-search"]) body.webSearchEnabled = true;

  const ac = new AbortController();
  const onSig = () => { ac.abort(); process.exit(130); };
  process.once("SIGINT", onSig);
  process.once("SIGTERM", onSig);

  const url = `${server.base}/api/generate/multimode`;
  const images: any[] = [];
  let doneInfo: any = null;
  try {
    for await (const ev of streamSse(url, { body, signal: ac.signal })) {
      switch (ev.event) {
        case "phase":
          if (!args.json) out(color.dim(`[phase] ${ev.data.phase} (max ${ev.data.maxImages ?? maxImages})`));
          break;
        case "partial":
          if (args["show-partial"] && !args.json) {
            const len = (ev.data.image || "").length;
            out(color.dim(`[partial #${ev.data.index}] (${len}B preview)`));
          }
          break;
        case "image":
          images.push(ev.data);
          if (!args.json) out(color.green(`✓ image ${images.length}`));
          break;
        case "done":
          doneInfo = ev.data;
          break;
        case "error":
          die(1, `multimode error: ${ev.data.error || ev.data}${ev.data.code ? ` (${ev.data.code})` : ""}`);
      }
    }
  } catch (e: any) {
    if (e.name === "AbortError") return;
    die(exitCodeForError(e), `${e.message}${e.code ? ` (${e.code})` : ""}`);
  }

  // Save images
  const outDir = args["out-dir"] || null;
  const explicitOut = args.out || null;
  if (explicitOut && images.length > 1) {
    if (!args.json) out(color.yellow(`(received ${images.length} images, --out only saves first)`));
  }

  const savedPaths: string[] = [];
  for (let i = 0; i < images.length; i++) {
    const im = images[i];
    if (!im.image) continue;
    let target;
    if (explicitOut && i === 0) target = explicitOut;
    else if (outDir) target = `${outDir}/${defaultOutName(i, images.length)}`;
    else target = `${config.storage.generatedDir}/${defaultOutName(i, images.length)}`;
    if (target) {
      await dataUriToFile(im.image, target);
      savedPaths.push(target);
    }
  }

  if (args.json) {
    json({ ok: true, requestId: doneInfo?.requestId, returned: doneInfo?.returned, paths: savedPaths });
  } else {
    for (const p of savedPaths) out(color.green("✓ ") + p);
    if (doneInfo) out(color.dim(`done: ${doneInfo.returned}/${doneInfo.requested ?? maxImages}`));
  }
}
