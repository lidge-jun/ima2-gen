# wp5 — CLI subcommand, SoT docs, packaged skill

## NEW `bin/commands/vectorize.ts`

Follows the `upscale` registration shape (`bin/commands/upscale.ts:18-117`) and the
`edit` local-file I/O shape (`bin/commands/edit.ts:94-106`).

```
ima2 vectorize <input.png> [options]
  -o, --out <path>        output .svg path (default: <input>.svg)
      --preset <name>     auto | flat | detailed | mono   (default: auto)
      --color-precision <1-8>
      --filter-speckle <0-128>
      --corner-threshold <0-180>
      --no-optimize
      --json
```

Runs **fully local** — it calls `vectorizeImageBuffer` directly and needs no server,
unlike `upscale`. Writes via `bin/lib/files.ts` `mkdir`-recursive + `writeFile`;
SVG text is written directly because that MIME map only knows PNG/JPEG/WebP.

Exit codes follow `bin/lib/output.ts:45-66`: validation errors `die` -> 2, runtime
failure `fail` -> 1. `--json` emits exactly one document:
`{ ok, input, output, preset, pathCount, bytes, elapsedMs }`.

## MODIFY `bin/ima2.ts`

Add `vectorize` to `helpOwningCommands` (`bin/ima2.ts:421`) AND to main help
(`bin/ima2.ts:326-358`). The scout found `upscale` is dispatched but missing from
both lists — we do not replicate that drift.

## SoT sync (SOT-SYNC-01)

| File | Change |
|------|--------|
| `structure/01-file-function-map.md` | add `lib/vectorizeImage.ts`, `bin/commands/vectorize.ts`, and `routes/assetDerived.ts` (missing today) |
| `structure/02-command-reference.md` | new row near local/asset commands |
| `structure/03-server-api.md:176-190` | Assets API currently omits `/api/assets/derived` — add it with both kinds |
| `docs/API.md:592-604` | row hardcodes `image/png`/`keyed-png`/`.png`; document `vector-svg` bodyless variant |
| `docs/API.zh-CN.md:588`, `docs/API.zh-TW.md:588` | same stale row |
| `docs/CLI.md:314-324` | new command row |

## MODIFY `skills/ima2/SKILL.md`

Insert `### Raster-to-Vector (SVG)` after the transparent-cutout strategy
(around :336-350) and before `### Korean Text in Images` (:390).

This closes a real gap: `skills/ima2-front/references/asset-requirements.md:33`
demands brand-safe SVGs and `SKILL.md:342` suggests `"flat vector style"` prompts,
while the toolchain could only ever emit raster. The new section documents the
two-step workflow — generate/key a cutout, then trace it — and states the honest
boundary (logos, icons, flat art, sprites yes; photographs and small text no).

## Verification + push

Full gate run at the exact head: `typecheck`, `typecheck:tests`, `test:inventory`,
`test:native-deps`, `test:install-policy`, `npm test`, `cd ui && npm run build`.
Then commit and push to `origin/dev` (pre-approved by the user in this request;
DEV-GIT-PUSH-01 scope is exactly that branch — no tags, no force, no release).

Note: the working branch is 1 ahead / 1 behind `origin/dev` at plan time, so wp5
re-checks divergence and integrates before pushing.
