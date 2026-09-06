// wp5 054: ima2 upscale — image/video upscale through the MCP media-action
// pipeline (Runway upscale_image/upscale_video). Image takes parameters;
// video takes none (provider schema) — flags on video are a hard error.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseArgs, type ParsedArgs } from "../lib/args.js";
import { resolveServer, fetchServer } from "../lib/client.js";
import { runMcpJob } from "../lib/mcpJob.js";
import { color, die, exitCodeForError, fail, json, out } from "../lib/output.js";
import { createCliRequestId } from "../lib/recover-output.js";

const MCP_UPSCALE_TIMEOUT_MS = 5 * 60_000 + 120_000 + 30_000;
const SCALE_FACTORS = new Set(["2", "4", "8", "16"]);
const FLAVORS = new Set(["sublime", "photo", "photo_denoiser"]);
const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;
const VIDEO_EXT = /\.(mp4|mov)$/i;

const SPEC = {
  flags: {
    "scale-factor": { type: "string" },
    flavor: { type: "string" },
    sharpen: { type: "string" },
    "smart-grain": { type: "string" },
    "ultra-detail": { type: "string" },
    out: { short: "o", type: "string" },
    "out-dir": { short: "d", type: "string" },
    json: { type: "boolean" },
    server: { type: "string" },
    help: { short: "h", type: "boolean" },
  },
};

const HELP = `
  ima2 upscale <generated-file> [options]

  Upscale an image or video through the Runway MCP lane.

  Options:
    --scale-factor <2|4|8|16>   Image only. Default: provider default (2)
    --flavor <sublime|photo|photo_denoiser>
                                Image only. scale-factor > 2 requires sublime
    --sharpen <0-100>           Image only
    --smart-grain <0-100>       Image only
    --ultra-detail <0-100>      Image only
    -o, --out <file>            Output path
    -d, --out-dir <dir>         Output directory
    --json                      Print one JSON result to stdout
    --server <url>              Override server URL
`;

function parsePercent(value: string, label: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 100) die(2, `${label} must be an integer 0-100`);
  return n;
}

export default async function upscaleCmd(argv: string[]): Promise<void> {
  try { await upscale(argv); }
  catch (error) {
    if (!(error instanceof Error)) throw error;
    fail({ json: argv.includes("--json"), code: (error as { code?: string }).code ?? "MCP_UPSCALE_FAILED",
      message: error.message, exitCode: exitCodeForError(error) });
  }
}

async function upscale(argv: string[]): Promise<void> {
  const args: ParsedArgs = parseArgs(argv, SPEC);
  if (args.help) { out(HELP); return; }
  if (args._unknown.length) die(2, `unknown option: ${args._unknown[0]}`);
  const file = args.positional[0];
  if (!file) die(2, "usage: ima2 upscale <generated-file> [options]");

  const isImage = IMAGE_EXT.test(file);
  const isVideo = VIDEO_EXT.test(file);
  if (!isImage && !isVideo) die(2, "file must be a generated png/jpg/webp image or mp4/mov video");

  const parameters: Record<string, unknown> = {};
  if (args["scale-factor"] !== undefined) {
    if (!SCALE_FACTORS.has(String(args["scale-factor"]))) die(2, "--scale-factor must be 2, 4, 8, or 16");
    parameters.scaleFactor = Number(args["scale-factor"]);
  }
  if (args.flavor !== undefined) {
    if (!FLAVORS.has(String(args.flavor))) die(2, "--flavor must be sublime, photo, or photo_denoiser");
    parameters.flavor = String(args.flavor);
  }
  if (args.sharpen !== undefined) parameters.sharpen = parsePercent(String(args.sharpen), "--sharpen");
  if (args["smart-grain"] !== undefined) parameters.smartGrain = parsePercent(String(args["smart-grain"]), "--smart-grain");
  if (args["ultra-detail"] !== undefined) parameters.ultraDetail = parsePercent(String(args["ultra-detail"]), "--ultra-detail");

  if (isVideo && Object.keys(parameters).length > 0) {
    fail({ json: Boolean(args.json), code: "INVALID_MEDIA_PARAMETERS",
      message: "video upscale takes no parameters (provider schema); remove the flags", exitCode: 2 });
  }
  if ((parameters.scaleFactor as number | undefined) !== undefined
    && (parameters.scaleFactor as number) > 2
    && parameters.flavor !== undefined && parameters.flavor !== "sublime") {
    fail({ json: Boolean(args.json), code: "INVALID_MEDIA_PARAMETERS",
      message: "scale-factor above 2 requires --flavor sublime", exitCode: 2 });
  }

  const server = await resolveServer({ serverFlag: args.server as string | undefined });
  const requestId = createCliRequestId("req_cli_upscale");
  const body = {
    action: isImage ? "upscale-image" : "upscale-video",
    files: [file],
    requestId,
    ...(Object.keys(parameters).length > 0 ? { parameters } : {}),
  };
  try {
    const result = await runMcpJob({
      serverBase: server.base, kind: isImage ? "image" : "video", body, requestId,
      timeoutMs: MCP_UPSCALE_TIMEOUT_MS, json: Boolean(args.json),
      postPath: "/api/mcp/media-action",
    });
    const target = args.out ? String(args.out) : args["out-dir"] ? join(String(args["out-dir"]), result.filename) : undefined;
    if (target) {
      const response = await fetchServer(server.base, result.url);
      if (!response.ok) die(1, `failed to download result: HTTP ${response.status}`);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, Buffer.from(await response.arrayBuffer()));
    }
    if (args.json) json({ ok: true, requestId, filename: result.filename, url: result.url, ...(target ? { path: target } : {}) });
    else out(color.green("✓ ") + (target ?? `${server.base}${result.url}`));
  } catch (error) {
    const typed = error as Error & { code?: string };
    fail({ json: Boolean(args.json), code: typed.code ?? "MCP_UPSCALE_FAILED", message: typed.message,
      exitCode: exitCodeForError(error) === 4 ? 4 : 1 });
  }
}
