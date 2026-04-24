import { parseArgs } from "../lib/args.js";
import { resolveServer, request, normalizeGenerate } from "../lib/client.js";
import { fileToDataUri, dataUriToFile, defaultOutName, readStdin } from "../lib/files.js";
import { out, err, die, color, json, exitCodeForError } from "../lib/output.js";

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
    help:      { short: "h", type: "boolean" },
  },
};

const HELP = `
  ima2 gen <prompt...> [options]

  Generate image(s) via the running ima2 server.

  Options:
    -q, --quality <low|medium|high>         Default: low
    -s, --size <WxH | auto>                 Default: 1024x1024
    -n, --count <1..8>                      Default: 1
        --ref <file>                        Attach reference image (repeatable, max 5)
    -o, --out <file>                        Single-image output path (implies -n 1)
    -d, --out-dir <dir>                     Output dir for multiple images
        --json                              Print JSON result to stdout
        --no-save                           Skip save; print b64 to stdout (use --force for TTY)
        --stdin                              Read prompt from stdin
        --timeout <sec>                     Default: 180
        --server <url>                      Override server URL

  Examples:
    ima2 gen "a shiba in space"
    ima2 gen "merge" --ref a.png --ref b.png -q high -o out.png
    cat prompt.txt | ima2 gen --stdin -n 2 -d ./out
`;

export default async function genCmd(argv) {
  const args = parseArgs(argv, SPEC);
  if (args.help) { out(HELP); return; }

  let prompt = args.positional.join(" ");
  if (args.stdin) {
    const piped = await readStdin();
    if (piped) prompt = prompt ? `${prompt} ${piped}` : piped;
  }
  if (!prompt) die(2, "prompt is required (positional or via --stdin)");

  const refs = args.ref || [];
  if (refs.length > 5) die(2, "max 5 --ref attachments");

  const n = Math.max(1, Math.min(8, parseInt(args.count) || 1));
  const timeoutMs = (parseInt(args.timeout) || 180) * 1000;

  let server;
  try {
    server = await resolveServer({ serverFlag: args.server });
  } catch (e) {
    die(exitCodeForError(e), e.message);
  }

  const references = await Promise.all(refs.map((p) => fileToDataUri(p)));

  const body = {
    prompt,
    quality: args.quality,
    size: args.size,
    n,
    references,
  };

  let resp;
  try {
    resp = await request(server.base, "/api/generate", { method: "POST", body, timeoutMs });
  } catch (e) {
    if (args.json) json({ ok: false, error: e.message, code: e.code, status: e.status });
    die(exitCodeForError(e), e.message);
  }

  const norm = normalizeGenerate(resp);
  if (norm.images.length === 0) die(1, "server returned no images");

  // --no-save path
  if (args["no-save"]) {
    const totalBytes = norm.images.reduce((s, im) => s + im.image.length, 0);
    if (process.stdout.isTTY && totalBytes > 2 * 1024 * 1024 && !args.force) {
      die(2, "refusing to print >2MB of b64 to TTY; use --force or drop --no-save");
    }
    for (const im of norm.images) out(im.image);
    return;
  }

  // Save path
  const outDir = args["out-dir"] || null;
  const explicitOut = args.out || null;
  if (explicitOut && norm.images.length > 1) {
    die(2, "--out only supports a single image; use --out-dir for n>1");
  }

  const savedPaths = [];
  for (let i = 0; i < norm.images.length; i++) {
    const im = norm.images[i];
    let target;
    if (explicitOut) {
      target = explicitOut;
    } else if (outDir) {
      target = `${outDir}/${defaultOutName(i, norm.images.length)}`;
    } else {
      target = defaultOutName(i, norm.images.length);
    }
    await dataUriToFile(im.image, target);
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
