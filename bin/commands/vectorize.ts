// wp5: ima2 vectorize - raster-to-SVG tracing. Runs fully local: unlike
// `upscale`, no server or provider is involved, so the command works offline.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { parseArgs, type ParsedArgs } from "../lib/args.js";
import { color, die, fail, json, out } from "../lib/output.js";
import { VECTOR_PRESETS, vectorizeImageBuffer, isVectorPreset } from "../../lib/vectorizeImage.js";

const SPEC = {
  flags: {
    preset: { type: "string" },
    "color-precision": { type: "string" },
    "filter-speckle": { type: "string" },
    "corner-threshold": { type: "string" },
    "no-optimize": { type: "boolean" },
    out: { short: "o", type: "string" },
    "out-dir": { short: "d", type: "string" },
    json: { type: "boolean" },
    help: { short: "h", type: "boolean" },
  },
};

const HELP = `
  ima2 vectorize <image> [options]

  Trace a raster image (png/jpeg/webp) into a real SVG. Runs locally; no server needed.

  Best on cutouts, icons, logos, and flat art. Photographs and small text will smear.

  Options:
    --preset <auto|flat|detailed|mono>   Trace mode. Default: auto
    --color-precision <1-8>              Colour bits per channel
    --filter-speckle <0-128>             Discard patches smaller than N pixels
    --corner-threshold <0-180>           Minimum angle treated as a corner
    --no-optimize                        Skip SVG optimization (larger output)
    -o, --out <file>                     Output path. Default: <input>.svg
    -d, --out-dir <dir>                  Output directory
    --json                               Print one JSON result to stdout
`;

function parseRange(raw: unknown, label: string, min: number, max: number): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) die(2, `${label} must be an integer ${min}-${max}`);
  return n;
}

export default async function vectorizeCmd(argv: string[]): Promise<void> {
  const args: ParsedArgs = parseArgs(argv, SPEC);
  if (args.help) { out(HELP); return; }

  const input = args.positional[0];
  if (!input) die(2, "usage: ima2 vectorize <image> [options]");

  const preset = args.preset === undefined ? "auto" : String(args.preset);
  if (!isVectorPreset(preset)) {
    die(2, `--preset must be one of: ${VECTOR_PRESETS.join(", ")}`);
  }
  const colorPrecision = parseRange(args["color-precision"], "--color-precision", 1, 8);
  const filterSpeckle = parseRange(args["filter-speckle"], "--filter-speckle", 0, 128);
  const cornerThreshold = parseRange(args["corner-threshold"], "--corner-threshold", 0, 180);

  const inputPath = resolve(String(input));
  const stem = basename(inputPath, extname(inputPath));
  const target = args.out
    ? resolve(String(args.out))
    : args["out-dir"]
      ? join(resolve(String(args["out-dir"])), `${stem}.svg`)
      : join(dirname(inputPath), `${stem}.svg`);

  try {
    const source = await readFile(inputPath);
    const result = await vectorizeImageBuffer(source, {
      preset,
      // Omit an unset knob: any value counts as an override and would bypass
      // the tuned preset.
      ...(colorPrecision !== undefined ? { colorPrecision } : {}),
      ...(filterSpeckle !== undefined ? { filterSpeckle } : {}),
      ...(cornerThreshold !== undefined ? { cornerThreshold } : {}),
      optimize: !args["no-optimize"],
    });
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, result.svg, "utf8");

    if (args.json) {
      json({
        ok: true,
        input: inputPath,
        output: target,
        preset: result.preset,
        pathCount: result.pathCount,
        bytes: result.bytes,
        elapsedMs: result.elapsedMs,
        width: result.width,
        height: result.height,
      });
    } else {
      out(color.green("OK ") + `${target} (${result.pathCount} paths, ${Math.round(result.bytes / 1024)}KB)`);
    }
  } catch (error) {
    const typed = error as Error & { code?: string };
    fail({
      json: Boolean(args.json),
      code: typed.code ?? "VECTORIZE_FAILED",
      message: typed.message,
      exitCode: 1,
    });
  }
}
