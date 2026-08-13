/**
 * Green-screen mp4 -> alpha WebM (VP9) derivation (devlog 260715_asset_gen_mode/031).
 *
 * Calibration (WP8 spike, 2026-07-15): ffmpeg chromakey similarity above ~0.15
 * eats low-saturation subjects (cream ceramics keyed at 0.18), while 0.05-0.12
 * keys a real generated green screen cleanly. UI tolerance 40 therefore maps to
 * similarity 0.10. Alpha survives the VP9/WebM roundtrip as BlockAdditional
 * side data — ffprobe pix_fmt reads plain yuv420p, so verification MUST decode
 * with the libvpx-vp9 decoder and inspect pixel alpha instead of trusting
 * ffprobe stream metadata.
 */
import { execFile } from "child_process";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import sharp from "sharp";
import { extractVideoFrame } from "./videoFrameExtract.js";

export type VideoKeyParams = {
  /** 0xRRGGBB, e.g. "0x22aa36" */
  keyColor: string;
  /** ffmpeg chromakey similarity, 0.01-1 */
  similarity: number;
  /** ffmpeg chromakey blend, 0-1 */
  blend: number;
};

export type ClientKeyParams = {
  keyColor?: { r: number; g: number; b: number };
  tolerance: number; // 0-100 (UI slider)
  softness: number;  // 0-50  (UI slider)
};

const KEYING_TIMEOUT_MS = 10 * 60 * 1000;

export function mapClientParamsToFfmpeg(p: ClientKeyParams): VideoKeyParams {
  const tolerance = Math.max(0, Math.min(100, p.tolerance));
  const softness = Math.max(0, Math.min(50, p.softness));
  // tolerance 0..100 -> similarity 0.02..0.22 (40 -> 0.10, spike-calibrated).
  const similarity = +(0.02 + (tolerance / 100) * 0.2).toFixed(3);
  // softness 0..50 -> blend 0..0.15 (10 -> 0.03).
  const blend = +((softness / 50) * 0.15).toFixed(3);
  const c = p.keyColor;
  const hex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  const keyColor = c ? `0x${hex(c.r)}${hex(c.g)}${hex(c.b)}` : "0x00ff00";
  return { keyColor, similarity, blend };
}

/**
 * Sample the background key color from the first frame's corner patches —
 * mirrors ui colorKey.sampleKeyColor so an omitted client keyColor still keys
 * the real (non-pure-green) generated background (WP9 regression fix).
 */
export async function sampleVideoKeyColor(srcAbs: string): Promise<{ r: number; g: number; b: number }> {
  const dir = await mkdtemp(join(tmpdir(), "ima2-keysample-"));
  const framePath = join(dir, "first.png");
  try {
    await extractVideoFrame(srcAbs, framePath, "0");
    const { data, info } = await sharp(framePath).raw().toBuffer({ resolveWithObject: true });
    const patch = 4;
    const xs = [0, Math.max(0, info.width - patch)];
    const ys = [0, Math.max(0, info.height - patch)];
    const rs: number[] = [], gs: number[] = [], bs: number[] = [];
    for (const px of xs) for (const py of ys) {
      for (let y = py; y < Math.min(py + patch, info.height); y++) {
        for (let x = px; x < Math.min(px + patch, info.width); x++) {
          const i = (y * info.width + x) * info.channels;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (r === undefined || g === undefined || b === undefined) continue;
          rs.push(r); gs.push(g); bs.push(b);
        }
      }
    }
    const median = (arr: number[]) => {
      const sorted = [...arr].sort((a, b) => a - b);
      return sorted[Math.floor(arr.length / 2)] ?? 0;
    };
    return { r: median(rs), g: median(gs), b: median(bs) };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export function buildKeyingArgs(srcAbs: string, outAbs: string, p: VideoKeyParams): string[] {
  if (!/^0x[0-9a-fA-F]{6}$/.test(p.keyColor)) throw new Error("invalid keyColor");
  if (!(p.similarity >= 0.01 && p.similarity <= 1)) throw new Error("similarity out of range (0.01-1)");
  if (!(p.blend >= 0 && p.blend <= 1)) throw new Error("blend out of range (0-1)");
  return [
    "-y", "-loglevel", "error", "-progress", "pipe:2", "-nostats",
    "-i", srcAbs,
    "-vf", `chromakey=${p.keyColor}:${p.similarity}:${p.blend},despill=type=green`,
    "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0",
    "-an",
    outAbs,
  ];
}

export async function keyVideoToWebm(
  srcAbs: string,
  outAbs: string,
  params: VideoKeyParams,
  onProgress?: (outTimeMs: number) => void,
  signal?: AbortSignal,
  execFileImpl: typeof execFile = execFile,
): Promise<void> {
  const args = buildKeyingArgs(srcAbs, outAbs, params);
  await new Promise<void>((resolve, reject) => {
    const child = execFileImpl("ffmpeg", args, { timeout: KEYING_TIMEOUT_MS, killSignal: "SIGKILL", maxBuffer: 8 * 1024 * 1024 }, (err, _stdout, stderr) => {
      if (err) {
        const e = err as NodeJS.ErrnoException;
        if (e.code === "ENOENT") {
          reject(new Error("ffmpeg not installed — install ffmpeg to derive alpha WebM assets"));
          return;
        }
        const tail = String(stderr || "").split("\n").filter(Boolean).slice(-4).join(" | ");
        reject(new Error(`ffmpeg keying failed${tail ? `: ${tail}` : ""}`));
        return;
      }
      resolve();
    });
    if (child.stderr && onProgress) {
      let buf = "";
      child.stderr.on("data", (chunk: Buffer) => {
        buf += chunk.toString();
        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          const m = /^out_time_ms=(\d+)/.exec(line);
          if (m) onProgress(Math.floor(Number(m[1]) / 1000));
        }
      });
    }
    signal?.addEventListener("abort", () => child.kill("SIGKILL"), { once: true });
  });
}
