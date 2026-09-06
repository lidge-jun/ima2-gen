import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { DoctorCheckLine } from "./doctor-checks.js";

const execFileAsync = promisify(execFile);

export async function buildMediaDoctorLines(): Promise<DoctorCheckLine[]> {
  try {
    await execFileAsync("ffmpeg", ["-version"], { timeout: 4000 });
    return [{ code: "FFMPEG_READY", kind: "pass", text: "ffmpeg available on PATH" }];
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return [{ code: "FFMPEG_MISSING", kind: "warn", text: "ffmpeg not on PATH (video features unavailable)" }];
    return [{ code: "FFMPEG_PROBE_FAILED", kind: "warn", text: "ffmpeg probe failed" }];
  }
}
