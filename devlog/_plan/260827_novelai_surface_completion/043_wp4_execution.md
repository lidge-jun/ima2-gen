# 043 — wp4 execution record

## RED

Three documentation contracts were added before prose changes. Baseline: 24 tests,
21 pass / 3 fail. The failures were exactly missing NAI skill guidance, missing CLI
native-flag/target rules, and missing API 13-field contract.

## Implementation

- `skills/ima2/SKILL.md`: one focused NovelAI section with four exact models, token
  handling, native CLI examples, V5 prompt guidance, cost guard, and explicit ima2
  text-to-image boundary. Existing generated MCP markers remain untouched.
- README/API/CLI and structure 00/02/03/04/06 synchronized. A final `pst-` search
  found structure 06 outside the original file map; it was added because the fixed
  prefix claim contradicted runtime validation.
- Official sources and access date are recorded in skill and 002 source ledger.

## GREEN before installation

- Skill/API/CLI contracts: 24 pass / 0 fail.
- Contract-doc projection: 2 pass / 0 fail; generated section byte-current.
- `uv run --with pyyaml ... quick_validate.py skills/ima2`: `Skill is valid!`.
- Devlog citations and `git diff --check`: exit 0.

The repository copy is committed before core-only installation into
`/Users/jun/.codex/skills/ima2`.
