# 000 — Structured Filename Format (native implementation, supersedes PR #116)

## Objective

Replace the unreadable `{timestamp}_{randomHex}_{index}.{ext}` generated-image
filename pattern with a structured `{model}_{aspect}_{date}_{slug}_{index?}.{ext}`
format, implemented natively on `feat/structured-filename` off `dev` and
squash-merged back. External PR #116 (Fausto-L) proposed the same spec but its
branch is stale-main based, CONFLICTING (90 files, +8079/-394, mostly unrelated
docs/UI/stats/i18n churn), with no CI and no review. We implement the spec
natively with a tight scope and close #116 as superseded with credit.

## Research summary (2026-07-25)

### PR #116 spec (extracted from fork Fausto-L/ima2-gen)

- `lib/filename.ts` (new, pure, no project imports):
  - `slugifyPrompt(prompt)` — trim, strip `/\:*?"<>|`, whitespace→`-`, collapse
    `-+`, trim edge hyphens, truncate to 20 chars, strip trailing `-`,
    fallback `"untitled"`. CJK preserved as-is.
  - `deriveAspect(size)` — parse `WxH` (`x` or `*`), GCD-reduce
    (`2368x1728`→`37x27`, `1920x1080`→`16x9`), fallback `"1x1"` on
    empty/unparseable/zero.
  - `buildFilename({model,size,createdAt,prompt,ext,index?})` —
    `{model}_{aspect}_{YYYYMMDD}_{slug}{_index?}.{ext}`, date UTC
    (`toISOString().slice(0,10)`).
- Scope per its own design doc: four image pipelines only — generate,
  multimode, agent(image), edit. Video, node store, canvas exports unchanged.
- Tests ported in `tests/filename.test.ts` (slugify/deriveAspect/buildFilename).

### Gap found in PR #116 (we fix natively)

- **Filename collision**: dropping the random hex means same
  model+aspect+date+slug+index on one day overwrites an earlier file
  (regenerating the same prompt twice). The PR spec/design never addresses
  this. Native implementation writes atomically with exclusive-create:
  `writeFileUnique(dir, name, data)` uses `writeFile(..., { flag: "wx" })`
  and appends `_2`, `_3`, … before the ext on EEXIST, returning the resolved
  name (no TOCTOU window — audit blocker #2).
- **Unsafe model names**: Atlas Cloud catalog models contain `/`
  (`openai/gpt-image-2/text-to-image`, lib/imageModels.ts:14) — raw
  interpolation would create path separators. `buildFilename` sanitizes the
  model component (`openai-gpt-image-2-text-to-image`) — audit blocker #1.
- **Control characters**: prompts with C0/C1 controls (e.g. NUL) survive the
  PR sanitizer and make fs writes reject the path. `slugifyPrompt` strips
  them first — audit blocker #4.
- **Unrelated churn**: 80+ of the PR's 90 files are docs/dashboard/stats/i18n
  drift from its stale base — none of it is taken.

### Current inline filename call sites (dev @ ae4e584)

| Site | Current pattern | In-scope vars |
|------|-----------------|---------------|
| `lib/generatePipeline.ts:428` | `${Date.now()}_${rand}_${images.length}.${resultFormat}` | `imageModel`, `effectiveSize`, `prompt`, `resultFormat`, `images.length`, grok-high rule at :288 |
| `lib/multimodePipeline.ts:275` | `${Date.now()}_${rand}_multimode_${index}.${resultFormat}` | `imageModel`, `effectiveSize`, `prompt`, `resultFormat`, `index` |
| `lib/agentImageVideoGen.ts:186` (image) | `${Date.now()}_${rand}_agent.${format}` | `generation.model`, `providerOptions.size` (:71), `prompt`, `format` |
| `routes/edit.ts:314` | `${Date.now()}_${rand}.${editExt}` | `imageModel`, `activeProvider`, `prompt`, `editExt` |

Out of scope (unchanged): `routes/video.ts:418`, `routes/videoExtended.ts:137/199`,
`lib/agentImageVideoGen.ts:340` (video), `lib/mcp/commitMediaResult.ts:29` (MCP),
node store (`saveNode`, lib/nodeStore.ts:20), sprite rows
(lib/spriteRowPipeline.ts:23), canvas versions (lib/canvasVersionStore.ts:111),
persistent local imports (lib/localImportStore.ts:39), comfyBridge upload
names. No migration/rename of existing files.

### Test-surface check

No existing test asserts the old image filename pattern; only
`tests/agent-mode-runtime-contract.test.ts` matches `_agent.mp4` (video,
unchanged). New tests live in `tests/filename.test.ts` (module) and
`tests/structured-filename-pipelines.test.ts` (pipeline behavior).

## Work-phase map (dependency-ordered, PHASE-SPLIT-01)

1. **Phase 1 — filename module** (`010_filename_module.md`): pure builders +
   atomic unique writer + full unit tests. Foundation; no callers yet.
2. **Phase 2 — pipeline integration** (`020_pipeline_integration.md`): wire the
   four image pipelines, remove dead random imports, full gates, squash-merge,
   close PR #116.

## Acceptance criteria

- `npm run typecheck`, `npm run typecheck:tests`, `npm test` green on merged dev.
- `tests/filename.test.ts` covers slug truncation/CJK/untitled, aspect GCD +
  fallback, buildFilename shape with/without index, and collision suffix `_2`.
- All four image save paths produce the structured name; video/MCP/node names
  byte-identical to before.
- PR #116 closed as superseded with an English comment crediting the spec.

## Non-goals

Video/MCP/node/sprite/canvas filename changes, gallery UI work, storage
migration, touching the contributor branch, any force-push.
