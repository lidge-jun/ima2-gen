# Issue #47 - In-flight Reload Reconcile

**GitHub**: https://github.com/lidge-jun/ima2-gen/issues/47
**Status**: planned / implementing
**Date**: 2026-04-29

## Problem

After a hard reload such as Cmd+Shift+R, the UI can briefly render generation
spinners from `localStorage` and then remove them once `/api/inflight`
reconciliation discovers that the server has no matching active or terminal
job.

This makes stale requests look like live work for about one polling tick. It
also makes post-reload debugging weak because terminal job snapshots are
memory-only and expire after 30 seconds.

## Root Cause

Current frontend boot order:

```text
useAppStore initial state
  -> activeGenerations = loadInFlight().length
  -> inFlight = loadInFlight()
  -> InFlightList renders immediately
  -> App useEffect calls reconcileInflight()
  -> stale local jobs are dropped
```

Current server terminal observability:

```text
finishJob() writes terminalJobs Map only
terminalTtlMs default = 30 seconds
terminalJobs disappear quickly after completion/failure
```

## Target Behavior

```text
1. Hard reload must not render stale local in-flight jobs as real active work.
2. Genuine server-active jobs must still reappear after reconciliation.
3. Terminal snapshots must remain inspectable for a practical reload/debug window.
4. The UI must still preserve out-of-scope local jobs during scoped reconciliation.
```

## Diff-Level Plan

### MODIFY - `ui/src/store/useAppStore.ts`

Before:

```ts
activeGenerations: loadInFlight().length,
inFlight: loadInFlight(),
```

After:

```ts
activeGenerations: 0,
inFlight: [],
```

Then `reconcileInflight()` uses persisted local state as its input snapshot:

```ts
const local = get().inFlight.length > 0 ? get().inFlight : loadInFlight();
```

This prevents pre-reconcile rendering while preserving request IDs and
out-of-scope jobs during the first reconciliation pass.

### MODIFY - `config.ts`

Before:

```ts
terminalTtlMs: ... 30 * 1000
```

After:

```ts
terminalTtlMs: ... 5 * 60 * 1000
```

Environment/config overrides continue to work through
`IMA2_INFLIGHT_TERMINAL_TTL_MS` and `fileCfg.inflight.terminalTtlMs`.

### MODIFY - `tests/inflight.test.js`

Add a regression test that proves terminal jobs survive at least 60 seconds and
are reaped after the configured 5 minute default window.

### NEW - `tests/inflight-reload-reconcile-contract.test.js`

Add a source-level contract test that locks the reload behavior:

```text
- initial store state does not call loadInFlight() for activeGenerations;
- initial store state does not call loadInFlight() for inFlight;
- reconcileInflight() explicitly uses loadInFlight() as the first-pass local snapshot;
- App.tsx still calls reconcileInflight() on mount.
```

## Acceptance Criteria

```text
- Reload no longer flashes stale local spinners before the first server reconcile.
- Server-active jobs still restore through /api/inflight.
- Terminal completion/error/cancel snapshots remain visible for 5 minutes by default.
- Focused tests pass.
- Typecheck passes.
```

## Non-Goals

```text
- Persist terminal jobs to SQLite.
- Add a new visible "checking in-flight" UI state.
- Change generation request lifecycle semantics.
- Commit or push.
```
