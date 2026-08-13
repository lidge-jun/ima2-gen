// Local ffmpeg concat (060 WP6): ordered stream-copy via the concat demuxer.
// Cancellable execFile pattern per lib/videoChromaKey.ts. Transcode is NOT
// attempted here — incompatible inputs return CONCAT_NORMALIZE_REQUIRED.
import { execFile } from "node:child_process";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MAX_INPUTS = 12;
const MAX_TOTAL_BYTES = 4 * 1024 * 1024 * 1024;
const CONCAT_TIMEOUT_MS = 5 * 60_000;

interface ProbeInfo { codec: string; width: number; height: number; }

function runFfTool(bin: "ffmpeg" | "ffprobe", args: string[], signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(bin, args, { timeout: CONCAT_TIMEOUT_MS, killSignal: "SIGKILL", maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return reject(new Error("FFMPEG_UNAVAILABLE"));
        const tail = String(stderr || "").split("\n").filter(Boolean).slice(-3).join(" | ");
        return reject(new Error(`FFMPEG_FAILED:${tail.slice(0, 200)}`));
      }
      resolve(String(stdout));
    });
    signal?.addEventListener("abort", () => child.kill("SIGKILL"), { once: true });
  });
}

async function probe(path: string, signal?: AbortSignal): Promise<ProbeInfo> {
  const out = await runFfTool("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height", "-of", "json", path], signal);
  const stream = (JSON.parse(out).streams ?? [])[0];
  if (!stream?.codec_name) throw new Error("CONCAT_INPUT_INVALID");
  return { codec: stream.codec_name, width: stream.width, height: stream.height };
}

/** Concat ordered local MP4s (stream-copy). Caller owns the output path. */
export async function concatVideos(inputPaths: string[], outputPath: string, options: { signal?: AbortSignal } = {}): Promise<void> {
  if (inputPaths.length < 2) throw new Error("CONCAT_NEEDS_TWO_INPUTS");
  if (inputPaths.length > MAX_INPUTS) throw new Error("CONCAT_TOO_MANY_INPUTS");
  let total = 0;
  for (const path of inputPaths) total += (await stat(path)).size;
  if (total > MAX_TOTAL_BYTES) throw new Error("CONCAT_TOO_LARGE");

  const probes = await Promise.all(inputPaths.map((p) => probe(p, options.signal)));
  const first = probes[0];
  if (!first) throw new Error("CONCAT_NORMALIZE_REQUIRED");
  if (probes.some((p) => p.codec !== first.codec || p.width !== first.width || p.height !== first.height)) {
    throw new Error("CONCAT_NORMALIZE_REQUIRED");
  }

  const dir = await mkdtemp(join(tmpdir(), "ima2-concat-"));
  try {
    const listPath = join(dir, "inputs.txt");
    await writeFile(listPath, inputPaths.map((p) => `file '${p.replaceAll("'", "'\\''")}'`).join("\n") + "\n");
    await runFfTool("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outputPath], options.signal);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
