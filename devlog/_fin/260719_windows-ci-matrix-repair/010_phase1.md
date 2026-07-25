# 010 — Phase 1: Windows matrix repair (4 classes)

## MODIFY / NEW / DELETE map

### W1 — MODIFY `bin/lib/output.ts`

Add and use a flush-before-exit helper:

```ts
export function exitFlushed(code: number): never {
  let pending = 2;
  const fin = () => { if (--pending === 0) process.exit(code); };
  process.stdout.write("", fin);
  process.stderr.write("", fin);
}
```

- `die`: replace `process.exit(code)` with `exitFlushed(code)`.
- `fail`: replace `process.exit(opts.exitCode ?? 2)` with `exitFlushed(...)`.
- Mechanical sweep: the other `process.exit(...)` call sites in
  bin/ima2.ts, bin/commands/{config,multimode,node,doctor,ping}.ts,
  bin/lib/{platform,videoMcp}.ts (22 total) route through `exitFlushed`
  where a stdout/stderr write can precede them; `process.exitCode = 1`
  assignments (natural exit) stay untouched.

### W2 — MODIFY two test files (platform guard, contract unchanged)

- tests/mcp-token-store.test.ts:33 (assertCleanSecure) and
  tests/mcp-snapshot-pipeline.test.ts:61: wrap the
  `mode & 0o777 === 0o600` assertion in
  `if (process.platform !== "win32")`. POSIX-only contract; Windows file
  ACLs enforce access instead. All other assertions (content, existence)
  unchanged.

### W3 — MODIFY `tests/mcp-temp-references.test.ts`

`realpathSync` the mkdtemp base dir (or compare via realpath on both
sides) so `RUNNER~1` short names and long names compare equal.

### W4 — MODIFY `tests/element-compiler.test.ts`

Replace POSIX literal expectations (`"/previous.png"`) with the
platform-aware `resolve("/previous.png")` from `node:path`, so the
assertion follows the source's `resolve()` contract on every OS.

## TESTS

Existing suites are the verifier; no new tests (W1 keeps CLI output
contracts identical — the same tests that failed on Windows must pass).

## Verification (C)

- `npm run typecheck` — 0 errors.
- `npm test` (node 24) — full suite green.
- `~/.nvm/versions/node/v22.22.3/bin/node --test tests/cli-commands.test.js`
  — green locally (CLI exit path).
- Push (pre-approved) + `gh run watch <id> --exit-status` — all four
  matrix jobs success.
