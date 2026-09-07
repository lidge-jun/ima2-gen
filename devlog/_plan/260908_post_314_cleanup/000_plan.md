# 260908 post-3.14.0 cleanup, backlog-to-zero, release

Loop-spec: archetype satisfy-spec; trigger = user review request on 2026-09-08 after
v3.14.0 ("PR/이슈 정리, 빈 rethrow 정리, dev 머지, 배포까지 cxc-loop"); goal = zero open
PRs, issues closed or precisely dispositioned, hygiene residuals fixed, dev->main
promoted, a new stable release published and visually verified from the published
artifact. Non-goals: 500-line file splits (user accepted), new providers beyond the
NAI quota lane, loopback API budget changes (follow-up note only), history rewrite,
gate bypass. Verifiers per unit doc; each was executed at A (rounds 1-2) with the exit
codes recorded there; `npm test` requires build:server, build:cli and the UI build first
(pr-fast.yml:63 does the same), otherwise source-tree tests reading emitted lib/*.js fail.
Stop: all goalplan criteria c-1..c-8 met with fresh evidence. Memory artifact: this
unit + .codexclaw goalplan ledger. Terminal outcomes: DONE / BLOCKED (remote gate after
two root-cause repairs) / UNSAFE (bypass, rewrite, paid spend) / NEEDS_HUMAN (approval
the account cannot give) / BUDGET_EXHAUSTED (72h total, 6h one WP). Escalation: any
push/merge/release is already user-authorized for this task; main reclaims a slice
after two distinct subagents fail it; new slices are P amendments.
Resource bounds (HOTL): existing gh account + hosted CI, isolated homes/ports,
existing browser tools; zero paid image generation; NAI probe is a free GET.

## Baseline (verified 2026-09-08)

- HEAD 36aa6fce = origin/main = origin/dev = origin/preview = v3.14.0; npm latest
  3.14.0 gitHead 36aa6fce; main CI/CodeQL/canary/package-health green.
- Open PRs: #194 #195 #196 (dependabot npm, base d39f9ea2/d2afe6b2, red only on
  `release provenance guard (wp9)` because the pr-fast.yml revision they ran used a
  shallow fetch-depth: 2 that hid the wp9 ancestor; see 020), #220 (actions, green).
- Open issues: #193 (NAI V5 battery quota), #150 (Adapter v1 RFC).
- Residuals from review: stale CHANGELOG `[Unreleased]`, unarchived 260905 unit,
  19 files / 51 sites with `catch (error) { throw error; }`, AGENTS.md convention wording.
- Local deps: this worktree had no node_modules at P; `npm ci` + `npm --prefix ui ci`
  were run before B so every verifier executes locally, not only in hosted CI.

## Audit log
- Round 2: GO-WITH-FIXES, 3 blockers folded (build-before-test ordering + explicit grep
  targets in 010; import-policy helper amendment in 040; gemini-api readiness = apiKey or
  vertexServiceAccountJson with four fixtures; delayed refusal kept inside execute()).
- Round 1 (gpt-6-astra reviewer): FAIL, 8 blockers. All folded: 040 rewritten (items
  1-2 scoped to sync-auth lanes, every test amendment named); 010 verifiers corrected
  and _fin allowlist added; 030 CLI/wire-type/consumer chain completed; 020 root cause
  corrected to shallow fetch-depth; 050 CHANGELOG conversion moved before the cut.

## Work-phase map (dependency order)

| WP | Doc | Depends | Independently verifiable close |
|---|---|---|---|
| wp1 hygiene | 010 | wp0 | PR to dev green + merged; rg count 0 for no-op rethrow in lib/ui |
| wp2 dependabot | 020 | wp0 | 4 PRs merged (or closed with reason); `gh pr list` empty except our own |
| wp3 #193 | 030 | wp1 | tests + /api/quota nai lane + QuotaCard; PR merged; issue closed |
| wp4 #150 | 040 | wp3 | criteria table comment; feasible items merged; disposition |
| wp5 release | 050 | wp1-4 | main==dev==preview==tag==npm gitHead; pages; visual proof |

wp1 and wp2 are independent of each other (wp2 targets main directly as dependabot
does; wp1 targets dev). wp5 requires dev to contain main (already true) and main to
contain every merged dependabot commit before promotion.

## Branch and PR plan

Working branch `codex/post-314-cleanup` (this worktree). Each WP publishes one
ordinary PR against `dev` from a per-WP branch cut from current `origin/dev`
(`codex/p314-wp1-hygiene`, `codex/p314-wp3-nai-quota`, `codex/p314-wp4-adapter`).
No native stacks. Merge with `gh pr merge --merge --match-head-commit <sha>`.
Dependabot PRs: `@dependabot rebase` comment (or manual rebase of the bot branch is
not owned by us; use the comment), wait for fresh PR Fast Gate on the new head.

## SoT sync targets (SOT-SYNC-01)

- `structure/03-server-api.md` (NAI 402 codes, /api/quota shape)
- `structure/04-frontend-architecture.md` (NAI error codes count 15 -> 16)
- `structure/07-devlog-map.md`, `devlog/_plan/README.md` (unit moves)
- `docs/API.md` (/api/quota returns { codex, grok, nai })
- `CHANGELOG.md`

## Roadmap lock (wp0 B, 2026-09-08)

Goalplan slug `ima2-gen-post-v3-14-0-cleanup-backlog-to-zero-de` binds the map below;
each later P re-verifies its doc against the tree at that time before building.

| Work-phase | Doc | Criteria | Class |
|---|---|---|---|
| wp1 | 010_wp1_hygiene.md | c-2 | C2 |
| wp2 | 020_wp2_dependabot.md | c-3 | C2 (external state) |
| wp3 | 030_wp3_nai_quota.md | c-4 | C3 |
| wp4 | 040_wp4_adapter_v1.md | c-5 | C3 |
| wp5 | 050_wp5_release.md | c-6, c-7, c-8 | C4 |

wp0 closes with c-1 once the full local gate (typecheck, typecheck:tests, test:inventory,
builds, npm test) passes on this docs-only tree, proving the baseline is green before
any implementation cycle starts.

