# 041 — wp4 stale check: packaged skill and source-of-truth

Date: 2026-08-27. Prior D direction: server, UI, and built CLI now agree on the
supported NAI tuning vocabulary; docs and skill still describe only provider selection.

## Skill Creator decision

This is a narrow update to the existing `ima2` skill. Keep guidance in its current
single `SKILL.md`: a new reference file would make discovery slower for a workflow that
fits one provider section. Preserve frontmatter and generated MCP markers. Add only
non-obvious lane decisions, current command examples, cost/surface boundaries, and V5
prompt guidance.

## Exact skill insertion

Modify `skills/ima2/SKILL.md` after the Grok paragraph in `## Generate Images`:

- discover `ima2 models --kind image --lane nai --json`;
- configure/persist `nai/nai-diffusion-5-full` or pass one of the four exact IDs;
- examples for negative prompt/native settings and V5 alpha;
- list Auto SMEA, Decrisper, Variety+, steps/guidance/CFG, sampler/schedule, seed,
  UC/quality presets and V5-only flags;
- official V5 prompting: English/Japanese are official, natural language and tags both
  work, quoted text and alpha tags;
- cost guard: Opus subscription/usage-limit rules, one image, no base/source image,
  <=28 steps, and normal <=1024x1024 are all required before treating a generation as
  no-Anlas; V5 usage limits can still apply and current account state must be checked;
- ima2 boundary: text-to-image only; refs/edit/mask/inpaint/Character Positioning/
  Vibe/Enhance are not exposed by ima2 and fail closed where applicable.

Do not duplicate the exhaustive CLI help alphabet; point to `ima2 gen --help` for the
live list.

## SoT files

- `README.md`: remove undocumented `pst-...` prefix claim; describe native controls
  and add two env defaults.
- `docs/API.md`: add NAI request fields to generation bodies; remove prefix claim;
  describe sparse defaults and explicit unsupported paths.
- `docs/CLI.md`: add a NovelAI flag table, command-specific target rules, examples,
  V5-only behavior, exit codes and text-to-image boundary.
- `structure/00-structure-hub.md`: correct token wording and append 2026-08-27
  server/UI/CLI/skill surface note.
- `structure/02-command-reference.md`: shared NAI option table for gen/multimode/node.
- `structure/03-server-api.md`: NAI capabilities defaults and request body projection.
- `structure/04-frontend-architecture.md`: NaiControlsPanel, negative prompt, sparse
  payload and V4.5/V5 control matrix.
- `structure/06-infra-operations.md`: remove the stale fixed-prefix token claim.
- `structure/01-file-function-map.md`: refresh line counts after skill/source docs only
  if the script reports drift.

The source ledger links must be cited by URL and access date in the skill/docs or the
wp4 execution record: official V5 release
`https://journal.novelai.net/image-generation-novelai-diffusion-v5-is-here-c2df7c6b8d2d/`
and subscription/usage rules `https://docs.novelai.net/en/subscription/`, accessed
2026-08-27. Wording must distinguish “NovelAI supports this product feature” from
“ima2 exposes this feature.”

## RED contracts

Extend `tests/cli-skill-command-contract.test.js` to require:

- four NAI model IDs and discovery/default examples;
- negative/native CLI options and V5 alpha example;
- text-to-image-only and unsupported-surface wording;
- cost and prompt-language guidance.

Extend `tests/cli-feature-parity-contract.test.js` so `docs/CLI.md` names the shared
flags/target rules. Extend API/doc contracts only through their existing owners if a
current gate already checks that file. Observe RED before prose changes.

Extend `tests/api-docs-contract.test.js` with a NovelAI request-contract case that
requires all 13 request keys, operator defaults `defaultAutoSmea` and
`defaultDecrisper`, the four exact model IDs, and
`NAI_REF_UNSUPPORTED` / `NAI_EDIT_UNSUPPORTED` / `NAI_MASK_UNSUPPORTED`. This is
mandatory because the existing route-presence test does not observe field-level drift.

## Installed skill projection

After repository tests and `npm run build:cli`:

```text
uv run --with pyyaml python /Users/jun/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/ima2
node bin/ima2.js skill install ima2 --dir /Users/jun/.codex/skills
cmp skills/ima2/SKILL.md /Users/jun/.codex/skills/ima2/SKILL.md
node bin/ima2.js skill --json
```

Install only the core `ima2` skill, not front/uiux, so unrelated installed skills are
untouched. The install happens after the repository copy is committed and verified.

## Verification

```text
node --test tests/cli-skill-command-contract.test.js tests/cli-feature-parity-contract.test.js
node --import tsx --test tests/contract-docs-projection.test.ts
node scripts/generate-contract-docs.mjs --check
uv run --with pyyaml python /Users/jun/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/ima2
npm run build:cli
node bin/ima2.js skill install ima2 --dir /Users/jun/.codex/skills
cmp skills/ima2/SKILL.md /Users/jun/.codex/skills/ima2/SKILL.md
node scripts/check-devlog-citations.mjs devlog/_fin/260827_novelai_surface_completion
git diff --check
```

Preflight receipt: the `uv run --with pyyaml ... quick_validate.py skills/ima2`
command exists and returned `Skill is valid!` on the current pre-change skill. It uses
an ephemeral dependency environment and does not modify repository dependencies.
