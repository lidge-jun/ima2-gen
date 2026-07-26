# 012 — Assets library lightbox integration

## Reported behavior

In `#assets`, clicking the media surface only selected the tile and opened the right-side details pane. The media lightbox was implemented only inside `AssetGenWorkspace`, so the separate Assets library had no preview action.

## Change

- Reused `AssetMediaLightbox` from `AssetsWorkspace`; no second modal implementation.
- Kept preview state local to the Assets workspace render tree.
- Made only `.assets-tile__preview` open the popup while also selecting the asset.
- Preserved tile/title selection for the details pane and preserved the delete `×` stop-propagation behavior.
- Converted asset records to the existing `GenerateItem` preview contract.
- Mapped `metadata.derivedKind: keyed-*` to the transparent checkerboard stage.
- Added hover/focus affordance and semantic preview labels for image enlargement and video playback.

## Attributed asset proof

The browser-tested video resolves to this persisted asset record:

```json
{
  "id": "a_01KXH2R98BRMKFHN6DJ3ZNWBXW",
  "kind": "video",
  "name": "a shiny red toy robot waving one arm, centered",
  "filePath": "1784058488050_e8af82b8.mp4",
  "metadata": {
    "source": "asset-gen",
    "backgroundPreset": "chroma-green",
    "provider": "grok",
    "requestId": "f_1784058443551_uv97l"
  }
}
```

## Verification

- `node --test tests/asset-gen-media-lightbox-contract.test.js`: 7 passed, 0 failed.
- `cd ui && npm run build`: passed (515 modules transformed).
- Browser QA on `http://127.0.0.1:3333/#assets`:
  - video dialog opened from the media surface;
  - native controls were present and playback advanced (`paused=false`, `currentTime=0.655`, `duration=5.042`, `readyState=4`);
  - closing the dialog left one selected tile and the existing details pane intact;
  - keyed image dialog used the checkerboard stage and toggled from fit to 2x zoom.
- Scoped `git diff --check` passed. Repository-wide `git diff --check` remains blocked by unrelated pre-existing trailing blank lines under `skills/ima2-front/`.

## Evidence

- `evidence/assets-library-video-open.png`
- `evidence/assets-library-keyed-image-zoom.png`
