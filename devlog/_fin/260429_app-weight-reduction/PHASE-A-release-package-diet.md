# Phase A - Release Package Diet

## Goal

Reduce install/package weight without changing runtime behavior.

This phase is explicitly **not** the runtime responsiveness fix. It reduces
release payload weight and install/update friction. Initial browser parse/execute
cost is handled in Phase B.

## Current Findings

`ui/vite.config.ts` currently enables production sourcemaps:

```ts
build: {
  outDir: "dist",
  sourcemap: true,
}
```

`package.json` currently includes all of `assets/`:

```json
"files": [
  "bin/",
  "lib/",
  "routes/",
  "integrations/",
  "ui/dist/",
  "docs/",
  "assets/",
  "server.js",
  "config.js",
  ".env.example",
  "README.md"
]
```

That can include screenshots, temporary test images, and other non-runtime
assets unless the package allowlist is tightened.

## Proposed Changes

### A.1 - Smallest Safe First PR

1. Make release sourcemaps opt-in.

   ```ts
   sourcemap: process.env.VITE_SOURCEMAP === "1"
   ```

2. Add a package contract test proving normal package dry-run excludes
   `ui/dist/**/*.map`.

3. Keep every existing runtime asset pattern unchanged in A.1.

### A.2 - Asset Allowlist After Inventory

1. Inventory every runtime asset path used by:

   - Card News templates;
   - prompt import / curated source flows;
   - ComfyUI integration and install docs;
   - screenshots/docs/site references;
   - package install smoke.

2. Tighten packaged assets only after the inventory is covered by tests.

   Prefer specific runtime paths instead of the entire `assets/` folder. Keep
   Card News templates if they are runtime-required; exclude screenshots and
   test-only images from npm release payload.

3. Add package contract tests.

   Contract should assert:

   - `ui/dist/*.map` is absent from normal package dry-run;
   - runtime-required Card News templates remain present if still needed;
   - screenshots and Phase A test PNG are not included;
   - ComfyUI integration remains included because it is an advertised install
     artifact.

## Candidate Files

- `ui/vite.config.ts`
- `package.json`
- `tests/package-smoke.test.js` or a new package-weight contract test

## Acceptance

```bash
npm run build
npm pack --dry-run --json
npm test
```

Pass criteria:

- no `.map` in the normal packed artifact;
- A.1 does not remove runtime assets;
- A.2 screenshots/test images absent from normal packed artifact only after
  inventory proves they are non-runtime;
- required runtime assets still present;
- existing package install smoke still passes.
