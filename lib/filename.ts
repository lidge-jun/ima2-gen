import { createHash, randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;
const UNSAFE_FS_CHARS = /[/\\:*?"<>|]/g;
const SLUG_MAX_CODE_POINTS = 20;
const MODEL_MAX_BYTES = 80;
const MAX_DIMENSION = 1_000_000;
const UNIQUE_MAX_ATTEMPTS = 100;

/** Truncate by code points (never splits a surrogate pair). */
function truncateCodePoints(value: string, max: number): string {
  const chars = Array.from(value);
  return chars.length <= max ? value : chars.slice(0, max).join("");
}

/** Truncate to a UTF-8 byte budget, appending a stable hash when cut. */
function truncateBytesWithHash(value: string, maxBytes: number): string {
  if (Buffer.byteLength(value, "utf8") <= maxBytes) return value;
  const hash = createHash("sha256").update(value).digest("hex").slice(0, 6);
  const budget = Math.max(1, maxBytes - hash.length - 1);
  let out = "";
  let used = 0;
  for (const ch of value) {
    const len = Buffer.byteLength(ch, "utf8");
    if (used + len > budget) break;
    out += ch;
    used += len;
  }
  return `${out.replace(/-+$/g, "")}-${hash}`;
}

/** Slugify a user prompt into a filesystem-safe string <=20 code points. CJK preserved. */
export function slugifyPrompt(prompt: string): string {
  const noControls = prompt.normalize("NFC").replace(CONTROL_CHARS, "");
  const trimmed = noControls.trim();
  const cleaned = trimmed.replace(UNSAFE_FS_CHARS, "");
  const spaced = cleaned.replace(/\s+/g, "-");
  const collapsed = spaced.replace(/-+/g, "-");
  const hyphenTrimmed = collapsed.replace(/^-+|-+$/g, "");
  const truncated = truncateCodePoints(hyphenTrimmed, SLUG_MAX_CODE_POINTS);
  const final = truncated.replace(/-+$/g, "");
  return final || "untitled";
}

/**
 * Sanitize a single filename component (model names). Unlike the prompt slug,
 * unsafe chars become "-" (readability) and there is no length cap here —
 * buildFilename applies the byte budget with a stable hash suffix.
 * "openai/gpt-image-2/text-to-image" -> "openai-gpt-image-2-text-to-image".
 */
export function sanitizeComponent(value: string, fallback = "unknown"): string {
  const noControls = value.normalize("NFC").replace(CONTROL_CHARS, "");
  const dashed = noControls.replace(UNSAFE_FS_CHARS, "-");
  const collapsed = dashed.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return collapsed || fallback;
}

/** GCD-reduce "WxH" ("x" or "*" separator); "1x1" when unparseable or out of range. */
export function deriveAspect(size: string): string {
  const match = /^(\d+)[x*](\d+)$/i.exec(size.trim());
  if (!match) return "1x1";
  const w = Number(match[1]);
  const h = Number(match[2]);
  if (!Number.isSafeInteger(w) || !Number.isSafeInteger(h)) return "1x1";
  if (w <= 0 || h <= 0 || w > MAX_DIMENSION || h > MAX_DIMENSION) return "1x1";
  let a = w;
  let b = h;
  while (b !== 0) {
    const t = a % b;
    a = b;
    b = t;
  }
  return `${w / a}x${h / a}`;
}

export interface FilenameOptions {
  model: string;
  size: string;
  createdAt: number;
  prompt: string;
  ext: string;
  index?: number;
}

/** {model}_{aspect}_{YYYYMMDD}_{slug}{_index?}.{ext} (date UTC, model sanitized + byte-capped). */
export function buildFilename(opts: FilenameOptions): string {
  const { model, size, createdAt, prompt, ext, index } = opts;
  const safeModel = truncateBytesWithHash(sanitizeComponent(model), MODEL_MAX_BYTES);
  const aspect = deriveAspect(size);
  const date = new Date(createdAt).toISOString().slice(0, 10).replace(/-/g, "");
  const slug = slugifyPrompt(prompt);
  const indexSuffix = index !== undefined ? `_${index}` : "";
  return `${safeModel}_${aspect}_${date}_${slug}${indexSuffix}.${ext}`;
}

/**
 * Atomic collision guard: exclusive-create `wx` write; on EEXIST append
 * `_2` ... `_100` before the extension, then fall back to high-entropy
 * suffixes. Selection and write are one atomic step — no TOCTOU window,
 * safe under concurrent identical requests. Returns the resolved filename.
 */
export async function writeFileUnique(
  dir: string,
  name: string,
  data: Buffer,
): Promise<string> {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  const candidates: string[] = [name];
  for (let n = 2; n <= UNIQUE_MAX_ATTEMPTS; n += 1) candidates.push(`${stem}_${n}${ext}`);
  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      await writeFile(join(dir, candidate), data, { flag: "wx" });
      return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      lastError = error;
    }
  }
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `${stem}_${randomBytes(3).toString("hex")}${ext}`;
    try {
      await writeFile(join(dir, candidate), data, { flag: "wx" });
      return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      lastError = error;
    }
  }
  throw lastError ?? new Error(`writeFileUnique: no free name for ${name}`);
}
