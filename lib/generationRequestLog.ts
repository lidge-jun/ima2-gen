import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { atomicWriteJson } from "./atomicWrite.js";

export type GenerationRequestLogEntry = {
  id: string;
  requestId: string;
  createdAt: number;
  prompt: string;
  requested: number;
  succeeded: number;
  error: string | null;
  /** Human-readable failure reason (260819). Absent on pre-260819 entries. */
  errorMessage?: string | null;
};

const MAX_ENTRIES = 200;
let writeQueue = Promise.resolve();

async function readEntries(path: string): Promise<GenerationRequestLogEntry[]> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

export async function listGenerationRequestLog(path: string): Promise<GenerationRequestLogEntry[]> {
  return readEntries(path);
}

export function appendGenerationRequestLog(
  path: string,
  entry: GenerationRequestLogEntry,
): Promise<void> {
  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    await mkdir(dirname(path), { recursive: true });
    const entries = await readEntries(path);
    await atomicWriteJson(path, [entry, ...entries].slice(0, MAX_ENTRIES));
  });
  return writeQueue;
}
