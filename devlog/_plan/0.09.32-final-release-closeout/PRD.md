---
created: 2026-04-26
tags: [prd, release-readiness, npm-release, github-pages, card-news]
status: draft
owner: Boss
---

# PRD — Final Release Closeout

## 1. Problem

`ima2-gen` has a green CI pipeline for the current main branch, but the release
audit found that green CI is not the same as release readiness. The npm package
version already matches the published `latest`, packaged install smoke is not a
release gate, dev-only Card News gate/package safety is under-tested, and public
docs make installer/runtime promises that are not fully documented as an
operational contract.

## 2. Goal

Ship a release candidate that can be safely published and promoted publicly.

The target user should be able to:

- Install the package from npm without version conflict.
- Start the app from the installed package.
- Understand where generated files live.
- Avoid confusing dev-only Card News with a stable public feature.
- Recover from common Windows npm update lock errors.
- Trust the GitHub Pages install commands because they match the release flow.

## 3. Non-Goals

- Do not redesign the app UI.
- Do not make Card News generally enabled by default unless explicitly decided.
- Do not add a new installer distribution channel beyond npm and GitHub Pages
  public scripts.
- Do not solve every future release automation problem; close the current
  publish blockers first.

## 4. Release Requirements

### R1 — Manual Version Awareness

- This PABCD must not bump `package.json` or `package-lock.json`.
- This PABCD must not run or automate `npm publish`, tag pushes, or GitHub
  releases.
- The final report must remind Jun that the current `package.json` version may
  need a manual bump before he publishes.

Acceptance:

```text
npm view ima2-gen version
package.json version reported separately
no version bump commit created by this PABCD
```

### R2 — Release Gate Coverage

- CI must run the existing package install smoke test.
- `prepublishOnly` or the release script must run the same release-critical
  checks used by CI.
- A failed package install smoke must block release.

Acceptance:

```text
npm test
npm run build
npm run test:package-install
npm run lint:pkg
```

### R3 — Dev-Only Card News Gate And Package Safety

- Card News must remain dev-only / explicitly gated through release closeout.
- Production/default runtime must not accidentally expose Card News UI/API.
- When explicitly enabled with `IMA2_CARD_NEWS=1`, packaged runtime must not
  break because of missing template metadata or image assets.
- Card News generated set storage should have regression coverage as a dev-only
  packaged-runtime safety net, not as a stable public feature promise.

Acceptance:

```text
default installed package does not expose Card News when the flag is off
installed package + IMA2_CARD_NEWS=1 returns /api/cardnews/image-templates
installed package + IMA2_CARD_NEWS=1 serves preview assets
npm pack --dry-run --json contains assets/card-news/templates/**
storage migration fixture covers generated/cardnews/<setId>/ as dev-only safety
```

### R4 — Public Documentation

Docs must explain:

- npm install and `ima2 serve` startup.
- OAuth-only image generation behavior.
- Card News is dev-only / experimental and not a stable public feature.
- Card News flag / visibility status only where needed to prevent confusion.
- Windows npm `EBUSY` update recovery.
- How GitHub Pages installer scripts relate to npm release.

Acceptance:

```text
README.md includes release-critical install/update notes
docs/FAQ.md includes Windows EBUSY and dev-only Card News clarification if needed
docs/FAQ.ko.md includes the same Korean troubleshooting and dev-only clarification
docs/README.ko.md links remain consistent with the Korean FAQ
site FAQ does not over-promise installer behavior or promote Card News as stable
```

### R5 — GitHub Pages Public Site Consistency

- Public FAQ install commands must match the actual script location.
- Public FAQ copy must not claim the installer is fetched from a raw GitHub URL
  when the page uses GitHub Pages installer URLs.
- The site must build after documentation/copy updates.
- Pages and npm release ordering must be documented for maintainers.

Acceptance:

```text
cd site && npm run build
site/public/install-mac.sh exists
site/public/install-windows.ps1 exists
FAQ copy does not reference missing root scripts as source of truth
```

## 5. Release Decision Matrix

| Area | Required Verdict |
|---|---|
| App tests | PASS |
| UI build | PASS |
| npm package smoke | PASS |
| packaged install smoke | PASS |
| site build | PASS |
| docs audit | PASS |
| CI on final HEAD | PASS |
| npm version uniqueness | PASS |

Any `NEEDS_FIX` or `BLOCKED` item blocks public release.

## 6. Risks

- Publishing with stale docs can make users run install commands that do not
  match the shipped package.
- Publishing without package install smoke can miss missing assets or runtime
  path bugs.
- Over-documenting Card News can accidentally turn a dev-only workflow into a
  public product promise.
- Reusing an already-published npm version will fail at publish time, but the
  actual version bump is a Jun-owned manual publish step outside this PABCD.

## 7. Open Decisions

- Final version number is intentionally not selected in this PABCD; Jun will
  decide it before manual publish.
- Card News remains dev-only through this release closeout.
- Release gate lives in CI verification and `prepublishOnly`; `scripts/release.sh`
  is not expanded in this PABCD.
