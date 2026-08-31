# 040 — Packaged ima2 skill and source-of-truth synchronization

Depends on: 010-030. Work phase: wp4.

## Scope

Make the agent-facing skill and public/current architecture docs tell the same truth
as the runtime. Do not advertise unsupported NovelAI product features.

## File changes

### MODIFY `skills/ima2/SKILL.md`

Add a `## NovelAI Image Generation` section near core image generation:

- discovery: `ima2 models --kind image --lane nai --json`;
- setup: token via Settings/API-key flow and readiness checks;
- default and one-shot model examples;
- NAI-native CLI flags and direct-mode prompt examples;
- negative prompt, quality/UC preset, Auto SMEA, Decrisper, Variety+, seed, V5 alpha;
- V5 prompt guidance: English/Japanese officially supported, tags and natural
  language, quoted text, alpha tags;
- cost warning around size/steps/count;
- explicit text-to-image-only boundary in ima2 and refusal codes for refs/edit/masks.

### MODIFY public and architecture docs

- `README.md`: concise lane capabilities and CLI example.
- `docs/API.md`: request fields/defaults and support boundary; remove any assertion
  that token validity depends on a `pst-` prefix.
- `docs/CLI.md`: full flag table and examples.
- `structure/00-structure-hub.md`: update the stale “persistent token (`pst-`)” claim
  and append 2026-08-27 surface completion note.
- `structure/02-command-reference.md`: three command surfaces and flags.
- `structure/03-server-api.md`: NAI option/default request contract.
- `structure/04-frontend-architecture.md`: current panel controls.
- `structure/01-file-function-map.md`: refresh generated line counts after source edits.

### Installed skill projection

After repository skill verification and CLI build:

```text
node bin/ima2.js skill install ima2 --dir /Users/jun/.codex/skills
cmp skills/ima2/SKILL.md /Users/jun/.codex/skills/ima2/SKILL.md
```

If the install command has changed, inspect `ima2 skill install --help`; do not copy
files by hand.

## Verification

```text
node bin/ima2.js skill --json
node bin/ima2.js skill install ima2 --dir /Users/jun/.codex/skills
cmp skills/ima2/SKILL.md /Users/jun/.codex/skills/ima2/SKILL.md
npm run docs:refresh-line-counts
node --test tests/cli-skill-command-contract.test.js tests/cli-feature-parity-contract.test.js tests/api-docs-contract.test.js
node --import tsx --test tests/contract-docs-projection.test.ts
```
