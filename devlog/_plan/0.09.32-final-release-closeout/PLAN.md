---
created: 2026-04-26
tags: [plan, release, npm, ci, docs, card-news]
status: draft
owner: Boss
prd: ./PRD.md
---

# PLAN — Final Release Closeout

## 1. Implementation Slices

### Slice A — Release Gate

Goal: make release-critical checks explicit and repeatable.

Modify:

- `package.json`
- `.github/workflows/ci.yml`
- `scripts/release.sh` if this repo uses it as the release path

Required behavior:

- CI runs `npm run test:package-install`.
- Release path runs `npm test`, `npm run build`, `npm run test:package-install`,
  and `npm run lint:pkg`.
- Failed package install smoke blocks release.

Verification:

```bash
npm test
npm run build
npm run test:package-install
npm run lint:pkg
```

### Slice B — Dev-Only Card News Gate And Package Smoke

Goal: keep Card News dev-only while proving packaged runtime does not break when
the feature is explicitly enabled for development.

Modify:

- `tests/package-smoke.test.js`
- `tests/package-install-smoke.mjs`
- `tests/storage-migration.test.js`

Required behavior:

- Default installed runtime does not expose Card News when the flag is off.
- `npm pack --dry-run` checks include Card News template `template.json`,
  `base.png`, and `preview.png` as packaged dev assets.
- Installed tarball smoke starts the server with `IMA2_CARD_NEWS=1`.
- Installed tarball smoke verifies dev-only routes:
  - `/api/cardnews/image-templates`
  - `/api/cardnews/image-templates/:id/preview`
- Storage migration fixture covers dev-only generated set shape:
  - `generated/cardnews/<setId>/manifest.json`
  - `generated/cardnews/<setId>/card-01.json`
  - `generated/cardnews/<setId>/card-01.png`

Verification:

```bash
node --test tests/package-smoke.test.js
npm run test:package-install
node --test tests/storage-migration.test.js
```

### Slice C — Release Docs

Goal: make public docs match actual release behavior.

Modify as needed:

- `README.md`
- `docs/FAQ.md`
- `docs/FAQ.ko.md`
- `docs/README.ko.md` only if the link/summary text needs adjustment
- `site/src/i18n/strings.ts`
- `site/src/components/FAQPage.astro`

Required docs:

- Install/update path.
- OAuth-only generation behavior.
- Card News remains dev-only / experimental through this release closeout.
- Card News flag/status is documented only enough to prevent accidental stable
  feature claims.
- Windows npm `EBUSY` recovery.
- npm release vs GitHub Pages installer script order.
- Site FAQ `faq.install.a3` must soften the "one command does everything"
  promise.
- Site FAQ `faq.install.a4` must describe the installer as hosted through
  GitHub Pages or public install scripts, not as a raw GitHub URL.

Verification:

```bash
rg "Card News|IMA2_CARD_NEWS|dev-only|experimental|EBUSY|install-mac|install-windows|raw GitHub" README.md docs site/src site/public
cd site && npm run build
```

## 2. Suggested Order

1. Implement Slice A.
2. Implement Slice B.
3. Implement Slice C.
4. Audit again.
5. Push and track CI.
6. Publish is a manual Jun-owned action after CI is green and version bump is
   separately approved.

## 3. Employee Audit Plan

Use read-only verification after implementation:

- Backend: release gate, package smoke, install smoke, dev-only Card News gate,
  and npm version awareness.
- Frontend: site FAQ copy, public install UX, Astro build.
- Docs: README/FAQ/site docs accuracy, missing operational notes, and no stable
  public Card News promise.

Each verifier returns:

```text
PASS | NEEDS_FIX | BLOCKED
```

## 4. Done Criteria

The lane moves to `_fin` only when:

- Backend audit is `PASS`.
- Frontend audit is `PASS`.
- Docs audit is `PASS`.
- CI is green on the release candidate HEAD.
- npm publish automation has not been added to CI.
- User separately handles version bump / npm publish when ready.
