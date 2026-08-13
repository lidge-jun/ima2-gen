import { execFile } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";

export type SpriteGifInput = { framePattern: string; outputPath: string; fps: number; loop: boolean; width?: number; height?: number };
export type SpriteGifValidationReport = { outputPath: string; fps: number; loop: boolean; disposal: 2; transparent: boolean; bytes: number };
const GIF_TIMEOUT_MS = 10 * 60 * 1000;

export function buildTransparentGifArgs(input: SpriteGifInput): string[] {
  if (!Number.isFinite(input.fps) || input.fps <= 0) throw new Error("fps must be positive");
  const scale = input.width && input.height ? `scale=${input.width}:${input.height}:flags=neighbor,` : "";
  return ["-y", "-loglevel", "error", "-framerate", String(input.fps), "-i", input.framePattern, "-filter_complex", `[0:v]${scale}split[a][b];[a]palettegen=reserve_transparent=1[p];[b][p]paletteuse=alpha_threshold=1:diff_mode=rectangle`, "-loop", input.loop ? "0" : "-1", input.outputPath];
}

async function enforceAndValidateGifControl(input: SpriteGifInput): Promise<number> {
  const data = await readFile(input.outputPath); let controls = 0;
  for (let index = 0; index + 7 < data.length; index++) {
    if (data[index] !== 0x21 || data[index + 1] !== 0xf9 || data[index + 2] !== 0x04) continue;
    const packed = data[index + 3];
    if (packed === undefined) continue;
    data[index + 3] = (packed & 0xe3) | (2 << 2) | 1; controls++;
  }
  if (!controls) throw Object.assign(new Error("GIF has no frame control extensions"), { code: "SPRITE_GIF_VALIDATION_FAILED", status: 500 });
  await writeFile(input.outputPath, data);
  const verified = await readFile(input.outputPath); let checked = 0;
  for (let index = 0; index + 7 < verified.length; index++) if (verified[index] === 0x21 && verified[index + 1] === 0xf9 && verified[index + 2] === 0x04) { const packed = verified[index + 3]; if (packed === undefined || ((packed >> 2) & 7) !== 2 || (packed & 1) !== 1) throw Object.assign(new Error("GIF disposal/transparency validation failed"), { code: "SPRITE_GIF_VALIDATION_FAILED", status: 500 }); checked++; }
  return checked;
}

function run(command: string, args: string[], impl: typeof execFile, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => { const child = impl(command, args, { timeout: GIF_TIMEOUT_MS, killSignal: "SIGKILL", maxBuffer: 8 * 1024 * 1024 }, (error, _stdout, stderr) => { if (!error) return resolve(); const code = (error as NodeJS.ErrnoException).code; const result = new Error(code === "ENOENT" ? "ffmpeg is not installed" : `ffmpeg GIF export failed: ${String(stderr).trim()}`) as Error & { status: number; code: string }; result.status = code === "ENOENT" ? 503 : 500; result.code = code === "ENOENT" ? "FFMPEG_UNAVAILABLE" : "SPRITE_GIF_ENCODE_FAILED"; reject(result); }); signal?.addEventListener("abort", () => child.kill("SIGKILL"), { once: true }); });
}

export async function exportTransparentGif(input: SpriteGifInput, options: { signal?: AbortSignal; execFileImpl?: typeof execFile } = {}): Promise<SpriteGifValidationReport> {
  try { await run("ffmpeg", buildTransparentGifArgs(input), options.execFileImpl ?? execFile, options.signal); await enforceAndValidateGifControl(input); await run("ffmpeg", ["-v", "error", "-i", input.outputPath, "-f", "null", "-"], options.execFileImpl ?? execFile, options.signal); const bytes = (await readFile(input.outputPath)).length; if (!bytes) throw new Error("decoded GIF is empty"); return { outputPath: input.outputPath, fps: input.fps, loop: input.loop, disposal: 2, transparent: true, bytes }; }
  catch (error) { await rm(input.outputPath, { force: true }).catch(() => undefined); throw error; }
}
