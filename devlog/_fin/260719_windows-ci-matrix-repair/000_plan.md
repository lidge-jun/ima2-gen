# 000 — windows-ci-matrix-repair: Plan

## Evidence base (CI run 29672987322, windows-latest node 22 + 24)

Four independent failure classes, each quoted from the CI log:

- W1 CLI fastfail: tests expecting exit 2 get 3221226505 (0xC0000409).
  Root: bin/lib/output.ts `die`/`fail` call `process.exit()` immediately
  after `process.stdout/stderr.write()` on piped stdio — the classic
  Windows abnormal-exit path. Affects: bare gen fail-closed, provider
  auto, Grok/MCP lane rejections, INPUT_ROLE_UNSUPPORTED, ref promotion.
- W2 POSIX mode assertions: `mode & 0o777 === 0o600` fails (438 !== 384);
  chmod is a no-op on Windows. Sites: tests/mcp-token-store.test.ts:33
  (assertCleanSecure), tests/mcp-snapshot-pipeline.test.ts:61.
- W3 8.3 short-path: expected `C:\Users\runneradmin\...`, got
  `C:\Users\RUNNER~1\...` — os.tmpdir()/mkdtemp vs the resolved path the
  route returns. Site: tests/mcp-temp-references.test.ts:88.
- W4 platform path join: elementCompiler `resolve("/previous.png")`
  returns `D:\previous.png` on Windows; the test expects the POSIX
  literal. Source behavior is correct per-platform; test literal is not.
  Site: tests/element-compiler.test.ts:62 (and sibling compileElements).

## Objective

Make the Windows CI jobs green without weakening any contract: W1 is a
real CLI robustness fix (flush before exit), W2/W3/W4 are test-harness
platform corrections (POSIX-only assertions get platform guards; path
comparisons get realpath/platform-aware expectations).

## Loop-spec

- Loop archetype: verifier-defined (spec-satisfaction repair).
- Write scope: `bin/lib/output.ts` (+ mechanical exit swaps in bin/*),
  `tests/mcp-token-store.test.ts`, `tests/mcp-snapshot-pipeline.test.ts`,
  `tests/mcp-temp-references.test.ts`, `tests/element-compiler.test.ts`.
- Out-of-scope: connection-manager (done), higgsfield, workflow changes,
  version bumps. Push approved unconditionally by the user this loop.
- Budget: one work-phase; verification is local node24/node22 suite +
  one CI watch cycle (windows runners are the only Windows env available).

## Work-phase map

| WP | Doc | Slice |
|----|-----|-------|
| 2 | 010_phase1.md | W1 exit-flush + W2 mode guard + W3 realpath + W4 platform path |

## Accept criteria

- C1: local `npm test` + `npm run typecheck` green (node24), focused
  files green on node22 where they exist.
- C2: CI run on the pushed commit: all four jobs success.
