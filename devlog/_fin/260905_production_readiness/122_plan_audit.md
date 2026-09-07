# WP12 A — lean plan audit and fold-back

Independent reviewer Confucius01a07611-5a5a-7810-80c1-8b1cc22292a8 reviewed121
against actual owners. Both model and effort were omitted; no leaf edits allowed.
Reviewer final: VERDICT: GO-WITH-FIXES (blockers=1).

Main accepts the remaining matcher ambiguity:121 now explicitly specifies
case-insensitive segment-exact /^\/api(?:\/|$)/i for both budget and token guard,
and names uppercase/mixedcase/root/apix plus GET/POST callback cases. Actual
Express matcher and current startsWith mismatch were independently reproduced
without listening or loading the real app. Callback exemption is exact path+GET.

Other clarifications accepted by reviewer: dedicated pure budget test instead of
running the real app locally; strict decimal safe nonnegative SSE cursor domain;
correct githubSource.ts owner. Baseline npm run typecheck, typecheck:tests and
ui typecheck:e2e all exit0 before product edits. No full/local app check performed.

Main judgment: near-pass, one blocker concretely folded into121; no unaddressed
High/Critical plan blocker. CodeQL source-only classifications are not acceptance;
their exact negative evidence and genuine repairs remain mandatory during B/C.
Do not close the historical MCP failure merely because a rerun passes.
