# 042 — wp4 audit synthesis

Round 1 reviewer verdict: FAIL. All five findings accepted for re-audit.

- 040 and 041 now both install only `ima2`, leaving front/uiux untouched.
- API field/default/refusal drift gets a mandatory RED contract in
  `tests/api-docs-contract.test.js`.
- `quick_validate.py` runs through an ephemeral `uv --with pyyaml` environment; the
  exact command was preflighted successfully.
- Cost wording includes Opus/usage state, one image, no base image, normal <=1024x1024,
  and <=28 steps without promising V5 is always free.
- Official V5 release and subscription URLs plus the 2026-08-27 access date are
  required, and docs must separate NovelAI product support from ima2 exposure.
