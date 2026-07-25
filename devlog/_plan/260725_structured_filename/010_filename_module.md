# 010 — Phase 1: `lib/filename.ts` module + unit tests (v2, audit fold-back)

Foundation phase. Pure builders plus an atomic exclusive-create writer. No
callers wired yet — pipelines switch in Phase 2 (`020_`).
v2 folds back Sol-audit blockers #1 (model sanitize), #2 (TOCTOU → `wx`),
#4 (control chars), #8 (inventory regen is mandatory).

## File change map

| Path | Action | What |
|------|--------|------|
| `lib/filename.ts` | NEW | `slugifyPrompt`, `sanitizeComponent`, `deriveAspect`, `buildFilename`, `writeFileUnique` |
| `tests/filename.test.ts` | NEW | node:test suites for all exports incl. concurrency |
| `docs/migration/runtime-test-inventory.md` | MODIFY (regenerated) | `npm run test:inventory` picks up the new test file (mandatory — `scripts/classify-tests.mjs --check` fails when stale) |

## `lib/filename.ts` (NEW) — full content shape

```ts
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;
const UNSAFE_FS_CHARS = /[/\\:*?"<>|]/g;

/** Slugify a user prompt into a filesystem-safe string <=20 chars. CJK preserved. */
export function slugifyPrompt(prompt: string): string {
  const noControls = prompt.replace(CONTROL_CHARS, "");
  const trimmed = noControls.trim();
  const cleaned = trimmed.replace(UNSAFE_FS_CHARS, "");
  const spaced = cleaned.replace(/\s+/g, "-");
  const collapsed = spaced.replace(/-+/g, "-");
  const hyphenTrimmed = collapsed.replace(/^-+|-+$/g, "");
  const truncated = hyphenTrimmed.slice(0, 20);
  const final = truncated.replace(/-+$/g, "");
  return final || "untitled";
}

/**
 * Sanitize a single filename component (model names). Unlike the prompt slug,
 * unsafe chars become "-" (readability) and there is no length cap.
 * "openai/gpt-image-2/text-to-image" -> "openai-gpt-image-2-text-to-image".
 */
export function sanitizeComponent(value: string, fallback = "unknown"): string {
  const noControls = value.replace(CONTROL_CHARS, "");
  const dashed = noControls.replace(UNSAFE_FS_CHARS, "-");
  const collapsed = dashed.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return collapsed || fallback;
}

/** GCD-reduce "WxH" ("x" or "*" separator); "1x1" when unparseable. */
export function deriveAspect(size: string): string {
  const match = /^(\d+)[x*](\d+)$/i.exec(size.trim());
  if (!match) return "1x1";
  const w = parseInt(match[1], 10);
  const h = parseInt(match[2], 10);
  if (!w || !h) return "1x1";
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(w, h);
  return `${w / d}x${h / d}`;
}

export interface FilenameOptions {
  model: string;
  size: string;
  createdAt: number;
  prompt: string;
  ext: string;
  index?: number;
}

/** {model}_{aspect}_{YYYYMMDD}_{slug}{_index?}.{ext} (date UTC, model sanitized). */
export function buildFilename(opts: FilenameOptions): string {
  const { model, size, createdAt, prompt, ext, index } = opts;
  const safeModel = sanitizeComponent(model);
  const aspect = deriveAspect(size);
  const date = new Date(createdAt).toISOString().slice(0, 10).replace(/-/g, "");
  const slug = slugifyPrompt(prompt);
  const indexSuffix = index !== undefined ? `_${index}` : "";
  return `${safeModel}_${aspect}_${date}_${slug}${indexSuffix}.${ext}`;
}

/**
 * Atomic collision guard (PR #116 gap, audit blocker #2): exclusive-create
 * `wx` write; on EEXIST append `_2`, `_3`, ... before the extension.
 * Selection and write are one atomic step — no TOCTOU window, safe under
 * concurrent identical requests. Returns the resolved filename.
 */
export async function writeFileUnique(
  dir: string,
  name: string,
  data: Buffer,
): Promise<string> {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let candidate = name;
  let n = 2;
  while (true) {
    try {
      await writeFile(join(dir, candidate), data, { flag: "wx" });
      return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      candidate = `${stem}_${n}${ext}`;
      n += 1;
    }
  }
}
```

Spec divergences from PR #116 (accepted audit blockers, recorded):

- `slugifyPrompt` strips C0/C1 control chars before processing (blocker #4);
  PR's `\t\n\r` case still yields `untitled` via the whitespace path.
- `buildFilename` sanitizes `model` (blocker #1); PR interpolated raw.
- Collision handling is an atomic writer, not a name checker (blocker #2).

## `tests/filename.test.ts` (NEW)

node:test + assert/strict. Cases:

- `slugifyPrompt`: trim+slugify (`"sunset over the mountains"`→`"sunset-over-the-moun"`),
  20-char truncation (`"a cute cat sitting on a windowsill"`→`"a-cute-cat-sitting-o"`),
  CJK preserved (`"美丽的日落景色"`), empty/whitespace/control-only (`"\t\n\r"`)
  → `"untitled"`, NUL-only input → `"untitled"`, embedded NUL stripped,
  strips `/\:*?"<>|`, collapses hyphens, trims edge hyphens, CJK+ASCII mix,
  CJK truncation ≤20.
- `sanitizeComponent`: `openai/gpt-image-2/text-to-image` →
  `openai-gpt-image-2-text-to-image`; control chars removed; empty → fallback.
- `deriveAspect`: `2368x1728`→`37x27`, `1024x1024`→`1x1`, `1920x1080`→`16x9`,
  `1024*1024`→`1x1`, `""`/`"auto"`→`1x1`, `1334x750`→`667x375`.
- `buildFilename`: full pattern with index
  (`wanx2.1-t2i-turbo_1x1_20260724_a-cute-cat-sitting-o_0.png` shape),
  index omitted when `undefined`, UTC date from `createdAt`, slash-model
  sanitized in the output name.
- `writeFileUnique`: returns base name when free; `_2` suffix on existing base
  (tmp dir fixture, real fs); `_3` when base and `_2` exist; **concurrency** —
  `Promise.all` of two identical writes resolves to two distinct names and
  both files exist with their own bytes; non-EEXIST errors (e.g. missing dir)
  propagate.

## Activation scenarios (C-ACTIVATION-GROUNDING-01)

- Collision branch: sequential `_2`/`_3` tests plus the concurrent
  `Promise.all` test drive the EEXIST retry loop for real and observe both
  distinct resolved names and on-disk bytes.
- Error branch: the missing-dir test observes the non-EEXIST rethrow.
- Fallback branches: `untitled`/`1x1`/`unknown` fallbacks each have a
  dedicated assertion.

## Verification

- `npm run typecheck` + `npm run typecheck:tests`
- `npm test` (or targeted run of `tests/filename.test.ts`)
- `node scripts/classify-tests.mjs` (regenerates
  `docs/migration/runtime-test-inventory.md`), then `npm run test:inventory`
  to verify the check passes
