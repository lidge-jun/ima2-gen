# 050 — wp5: full verification, SoT sync, push to origin/dev

Depends on wp1-wp4. This phase adds no feature code; it proves the lane and
lands it.

## 1. Gate sweep (goalplan c8, c9)

Run in this order, capturing exit codes fresh. A remembered pass is not
evidence (LOOP-CONTINUE-01).

```
npm run typecheck
npm run typecheck:tests
node scripts/generate-provider-types.mjs --check
npm run test:inventory
npm test
cd ui && npm run build
```

`npm run test:provider-registry` is included implicitly by the generator check
plus the registry tests, but run it explicitly too — it is the gate that pairs
the registry with the generated UI catalog.

Expected: typecheck, typecheck:tests, generator check, and the UI build all exit
0. `npm test` reports strictly more passing cases than the pre-change baseline
(the new NAI tests) and **no new failures** beyond the recorded carve-out:

> 2 pre-existing failures in `tests/cli-models-command-contract.test.ts`
> (header regex + `executable` field), unrelated to this unit. See
> `000_plan.md` §Pre-existing failure carve-out and `003_audit_amendments.md` B5.

Do NOT fix those two here — that is unrelated scope. Do NOT claim a green
`npm test`.

### Test inventory (audit M2)

New `tests/nai-*.test.ts` files make the generated inventory stale, so
`npm run test:inventory` (which runs `--check`) fails until it is regenerated:

```
node scripts/classify-tests.mjs
```

Commit the regenerated `docs/migration/runtime-test-inventory.md`.

## 2. Live server proof (goalplan c5)

Boot the built server with **no NAI token configured** and capture real output:

```
curl -s localhost:<port>/api/models   | jq '.lanes.nai'
curl -s localhost:<port>/api/keys/status | jq '.nai'
```

Expected:

- `.lanes.nai.image` lists the four model ids, `.video` empty.
- `.lanes.nai` state is `key-missing` (not `ready`, not missing).
- `.nai` key status is `{configured:false, source:"none", valid:false}`.

This is the activation proof for the wp1 nine-site key chain and the wp3 lane
registration: neither row can appear unless both are wired.

Tear the server down afterwards and record the teardown.

## 3. Render grounding (goalplan c6)

Screenshot the built UI's provider selector at 1280x720, read the image back,
and persist it into this unit folder. Confirm NovelAI appears with four
correctly-labelled models.

## 4. SoT sync (SOT-SYNC-01)

Patch the repo's source-of-truth docs so they do not silently diverge:

| Doc | Update |
|-----|--------|
| `structure/00-structure-hub.md` | provider count / lane list |
| `structure/01-file-function-map.md` | `lib/naiImageAdapter.ts`, `lib/naiZip.ts`, `lib/providers/adapters/nai.ts` |
| `structure/03-server-api.md` | `nai` lane in `/api/models`, `nai` in `/api/keys` |
| `structure/07-devlog-map.md` | this unit |
| `AGENTS.md` | provider list line, if it enumerates providers |

## 5. Commit discipline (DEV-GIT-COMMIT-01)

Atomic commits, one per work-phase step, on `dev`. Never `git add -A` from the
repo root: the worktree carries unrelated user changes
(`docs/grok-video-i2v-research.md` modified, `devlog/_plan/260823_minimax_h3/030_wp3_live_proof.md`
untracked) that are **not ours to commit**. Stage explicit paths only.

`lib/**/*.js` is gitignored; verify `git status` shows no compiled siblings
before each commit.

## 6. Push (goalplan c10)

The user pre-approved pushing this scope to `dev` (DEV-GIT-PUSH-01 satisfied by
explicit instruction; the approval covers `dev` only — no other branch, no
force, no tags).

```
git push origin dev
git rev-parse dev origin/dev
```

Proof required: push output plus both SHAs equal. If the remote rejects
(non-fast-forward), that is `BLOCKED` — fetch, inspect, and report rather than
forcing.

## 7. Handoff note

The user supplies the NovelAI token after waking, via Settings → API keys, or
by exporting `NOVELAI_API_KEY`. Until then the lane correctly reports
`key-missing`. First real generation is the user's own end-to-end confirmation;
this unit deliberately never spends their Anlas.

## Accept criteria

1. Every command in §1 exits 0, output captured.
2. §2 curl output matches expectations, captured verbatim.
3. §3 screenshot exists and was read back.
4. §4 docs patched.
5. §6 SHAs equal, unrelated user changes still uncommitted and intact.

## Terminal outcome

`DONE` only when 1-5 all hold. Anything less is reported as its real outcome.
