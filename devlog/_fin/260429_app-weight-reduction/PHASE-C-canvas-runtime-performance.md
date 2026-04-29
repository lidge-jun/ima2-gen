# Phase C - Canvas Runtime Performance

**Status**: implemented / closeout verified after B.3
**Date**: 2026-04-29

## Goal

Reduce Canvas Mode CPU spikes without weakening output quality.

## Closeout Summary

Phase C is satisfied by the current Canvas Mode implementation after the B.3
workspace split.

Implemented coverage:

- stale async background-cleanup renders are ignored through `renderSeqRef`;
- tolerance-driven mask overlay refresh is debounced through `toleranceTimerRef`;
- alpha detection is cached per image element/source/dimensions in
  `alphaDetect.ts`;
- mask overlay preview can downscale through
  `BACKGROUND_REMOVAL_OVERLAY_MAX_DIMENSION`;
- final background cleanup apply recomputes from the natural image element and
  does not reuse preview blobs;
- merge/export/mask renderers continue to use natural image dimensions.

## Non-Negotiable Invariant

Preview work may be downscaled, but final apply/export must always render from
the original/natural source image and preserve natural dimensions.

This invariant is now covered by
`tests/canvas-background-cleanup-contract.test.js`.

## Verification

```bash
node --test tests/canvas-background-cleanup-contract.test.js
node --test tests/canvas-viewport-pan-contract.test.js
node --test tests/app-weight-splitting-contract.test.js
npm run typecheck
npm run ui:build
npm test
npm run prepublishOnly
```

## Remaining Risk

`CanvasModeWorkspace.tsx` is under the 500-line limit but close to it. Future
Canvas Mode work should go into the extracted hooks/components rather than
expanding the workspace file.
