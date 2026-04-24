# 02 Generate-Time Adjustment Confirm Plan

## Goal

When Custom size values violate image constraints, do not silently adjust them
while typing. Instead, stop at Generate time and show a confirmation popup with
the requested size, adjusted size, and reason.

## Revised UX

1. User types Custom width/height freely.
2. Inputs keep the requested values.
3. User clicks Generate.
4. App checks the requested custom size.
5. If no adjustment is needed, generation starts immediately.
6. If adjustment is needed, show a blocking confirm modal:

```text
크기 조정이 필요합니다

요청한 크기: 1024x3824
조정될 크기: 1280x3824
이유: 비율 제한 3:1을 초과했습니다.

[승인 후 생성] [취소]
```

7. Approve:
   - update the input numbers to the adjusted size
   - continue the original Classic or Node generation with the adjusted size
8. Cancel:
   - close modal
   - keep the requested values in the inputs
   - do not generate

## Key Product Decision

The Custom size fields should represent the user's requested values, not always
the final normalized values. Normalization becomes a generate-time gate.

This differs from the previous toast idea:

- Toast plan: adjust immediately and tell the user after the fact.
- Revised plan: ask for approval before using adjusted values.

## Current Blocker

The current implementation normalizes on input commit:

- `SizePicker.commitCustomSize()` calls `normalizeCustomSizePair(...)`
- `useAppStore.setCustomSize(...)` also normalizes

This means invalid requested values cannot survive until Generate. To support the
confirm flow, the store must preserve requested custom values and generation must
normalize before sending the request.

## Audit Update

Initial plan audit failed because it only covered Classic generation. Node mode
also uses the global custom size through `getResolvedSize()`, so invalid
requested values could reach `generateNode()` without a confirmation gate.

Revised requirement:

- Classic generation and Node generation must share the same custom-size
  confirmation gate.
- Pending confirmation state must remember which generation should continue
  after approval.
- API send paths must use adjusted/resolved size; input display can keep
  requested size until approval.

## Planned Files

- `ui/src/lib/size.ts`
- `ui/src/store/useAppStore.ts`
- `ui/src/components/SizePicker.tsx`
- `ui/src/components/CustomSizeConfirmModal.tsx`
- `ui/src/App.tsx`
- `ui/src/index.css`
- `ui/src/i18n/ko.json`
- `ui/src/i18n/en.json`
- `tests/size-custom-input-contract.test.js`

## Implementation Shape

### Size helper

Add a detailed helper:

```ts
type CustomSizeAdjustmentReason = "min" | "max" | "ratio" | "pixels" | "snap";

type CustomSizeNormalizationResult = {
  requestedW: number;
  requestedH: number;
  w: number;
  h: number;
  adjusted: boolean;
  reasons: CustomSizeAdjustmentReason[];
};
```

Keep `normalizeCustomSizePair(...)` for final normalized pair usage.

### Store state

Add pending confirmation state:

```ts
type CustomSizeConfirmState = {
  requestedW: number;
  requestedH: number;
  adjustedW: number;
  adjustedH: number;
  reasons: CustomSizeAdjustmentReason[];
  continuation:
    | { kind: "classic" }
    | { kind: "node"; clientId: ClientNodeId };
} | null;
```

Add actions:

```ts
confirmCustomSizeAdjustment: () => Promise<void>;
cancelCustomSizeAdjustment: () => void;
```

Change `generate()` and `generateNode()` flow:

```text
generate() or generateNode(clientId)
  prompt check
  if custom size and not already confirmed:
    normalize requested pair
    if adjusted:
      set pending confirmation with continuation context
      return
  continue actual generation
```

To avoid recursion/infinite loops, split the generation bodies:

```ts
generate()
runGenerate(sizeOverride?: string)

generateNode(clientId)
runGenerateNode(clientId, sizeOverride?: string)
```

Approve action should inspect the pending continuation:

```ts
if (pending.continuation.kind === "classic") {
  await get().runGenerate(`${pending.adjustedW}x${pending.adjustedH}`);
}

if (pending.continuation.kind === "node") {
  await get().runGenerateNode(
    pending.continuation.clientId,
    `${pending.adjustedW}x${pending.adjustedH}`,
  );
}
```

### SizePicker

Do not normalize pair on blur/Enter. It should only commit requested numeric
draft values to the store.

Example:

```text
User enters 1024x3824
Blur/Enter keeps inputs as 1024x3824
Generate opens confirm modal
Approve updates inputs to 1280x3824
```

### Modal

New component:

```text
ui/src/components/CustomSizeConfirmModal.tsx
```

Use existing modal styling patterns from `ApiDisabledModal` / `ErrorCard`.

Buttons:

- Korean: `승인 후 생성`, `취소`
- English: `Approve and generate`, `Cancel`

Accessibility and layering:

- `role="dialog"` and `aria-modal="true"`
- `aria-labelledby` and `aria-describedby`
- Escape key cancels
- Initial focus should go to Cancel to avoid accidental generation
- custom confirm backdrop z-index must be higher than toast/gallery overlays

## QA Cases

- `2048x2048` -> Generate starts immediately, no modal.
- `1024x3824` -> modal shows requested/adjusted/reason ratio.
- Approving `1024x3824` updates inputs to `1280x3824` and generates.
- Canceling keeps `1024x3824` in the inputs and does not generate.
- Node mode generation uses the same modal gate.
- Approving a Node-mode adjustment resumes the same node generation.
- Canceling a Node-mode adjustment leaves the node untouched and creates no
  in-flight state.
- `3824x3824` -> modal shows pixel-limit reason and `2880x2880`.
- `900x2048` -> modal shows min-size reason and `1024x2048`.
- Keyboard typing no longer turns into `00000`.
- Custom row still does not overflow the right panel.

## Test Additions

- `generateNode()` also uses the custom-size confirm gate or shared
  generation-size resolver.
- Pending confirmation includes continuation context for Classic and Node.
- Modal has title/body aria ids and Escape handling.
- Custom confirm backdrop z-index is above toast/gallery overlays.

## Implementation Notes

- `SizePicker` now commits requested custom numbers only; it does not normalize
  ratio or pixel constraints on blur/Enter.
- `generate()` and `generateNode(clientId)` both check custom size before any
  in-flight or graph mutation side effects.
- `runGenerate(sizeOverride?)` and `runGenerateNode(clientId, sizeOverride?)`
  hold the actual API/in-flight work.
- The pending confirm state carries `classic` or `node` continuation context.
- `CustomSizeConfirmModal` blocks generation until approve/cancel, focuses
  Cancel initially, and cancels on Escape.

## Verification

Focused:

```bash
node --test tests/size-custom-input-contract.test.js
```

Result:

```text
tests 10
pass 10
fail 0
```

Build:

```bash
npm run build
```

Result:

```text
pass
```

Browser check:

```text
Classic custom input 1024x3824
Generate opens confirm modal
Cancel closes modal and keeps inputs as 1024x3824
Approve with mocked /api/generate updates inputs to 1280x3824
Approve sends one generate request and closes modal
```
