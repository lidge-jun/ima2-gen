---
created: 2026-04-26
tags: [ima2-gen, final-release, release-readiness, npm, github-pages]
aliases: [ima2 final release closeout, ima2 deploy blocker plan, 0.09.32 release]
status: draft
owner: Boss
source: deploy-readiness-audit
---

# 0.09.32 — Final Release Closeout

This folder is the final closeout lane before public npm release / GitHub Pages
promotion. It turns the deploy-readiness audit blockers into a concrete product
and engineering checklist.

## Source Of Truth

- [PRD.md](./PRD.md) — product requirements and release acceptance criteria.
- [PLAN.md](./PLAN.md) — implementation slices, file targets, and verification gates.

## Current Verdict

The latest audit verdict is:

```text
Frontend/app build: PASS
Current CI: PASS
Backend/npm release readiness: NEEDS_FIX
Docs/public release readiness: BLOCKED
Overall: BLOCKED
```

This lane is complete only when the overall verdict becomes:

```text
Overall: PASS
```

## Blocker Summary

1. npm cannot publish the current `1.1.0` version again because `latest` is
   already `1.1.0`; the actual version bump remains Jun's manual publish step.
2. CI and `prepublishOnly` do not yet run the packaged install smoke test.
3. Card News is intentionally dev-only, but its gate/package safety is not
   sufficiently covered by tests.
4. Public docs/site must not present Card News as a stable public feature.
5. Windows update recovery for `EBUSY` is not documented.
6. GitHub Pages installer scripts and npm release order are not documented as an
   operational contract.

## Done Means

- No version bump, publish, tag push, or GitHub Release automation is added in
  this PABCD.
- The final report calls out that Jun must choose and run the version bump before
  manual publish.
- `npm test`, UI build, package smoke, packaged install smoke, and site build pass.
- CI validates the packaged install path at least once.
- Docs explain installation, update recovery, dev-only Card News gating, and
  npm/Pages release order without promoting Card News as stable.
- The release candidate commit is pushed and CI is green on the final HEAD.
