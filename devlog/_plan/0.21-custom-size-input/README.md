# 0.21 Custom Size Keyboard Input Bug

## Status

- Date: 2026-04-24
- Status: implemented
- Scope: quick UI bug fix for custom image size inputs
- Screenshot: `/Users/jun/.cli-jaw-3458/uploads/1777023934774_6ecdc893_Screenshot2026-04-24at64508PM.png`

## Symptom

When the user opens the Custom size controls and types a number with the keyboard,
the input can collapse into values like `00000` or otherwise fail to preserve the
typed number. Dragging/spinner-style adjustment can appear to work, but direct
typing is unreliable.

## Relevant Code

- `ui/src/components/SizePicker.tsx`
  - The inputs are controlled by `customW` and `customH`.
  - Each `onChange` immediately calls `setCustomSize(parseInt(value) || 1024, ...)`.
  - The fields use `type="number"`, `min`, `max`, and `step`.
- `ui/src/store/useAppStore.ts`
  - `setCustomSize` immediately snaps both dimensions with `snap16`.
- `ui/src/lib/size.ts`
  - `snap16(n)` rounds every numeric update to a multiple of 16.

## Root Cause Hypothesis

The same state is being used for two different jobs:

1. temporary keyboard draft text while the user is still typing
2. final committed custom size used by image generation

Because the committed numeric state is rewritten on every keystroke, intermediate
typing states are not allowed to exist. For example, typing `2048` can briefly
produce partial values like `2`, `20`, or an empty string. The current handler
parses and snaps those partial states immediately, then React writes the snapped
number back into the input. Browser `type="number"` normalization can compound
this and make the field appear to turn into repeated zeroes.

## Constraint Rules

The custom size commit path must preserve the existing image constraints:

- each side is a multiple of 16
- each side is at least `1024`
- max side is `3824` in current UI presets
- aspect ratio is at most `3:1`
- pixel count stays inside the existing backend/test range

For values below `1024`, the commit path should clamp that side to `1024`.
After clamping, the pair should be normalized together so the other side cannot
leave the final pair above `3:1`.

Example outcomes:

- `900x2048` -> `1024x2048`
- `1024x3824` -> `1280x3824` because `1024x3824` is wider than `3:1`
- `3824x1024` -> `3824x1280` for the same reason

## Fix Direction

Use local draft strings in `SizePicker` while the field is focused.

- `onChange`: update only the draft string.
- `onBlur` and `Enter`: parse, clamp, snap, and commit to the store.
- Use `type="text"` with `inputMode="numeric"` so the browser does not rewrite
  partial numeric text.
- Keep final committed dimensions numeric in the store.
- Centralize min/max/snap/ratio normalization in `ui/src/lib/size.ts`.

## QA Cases

- Typing `2` into an empty custom width field keeps `2` visible while editing.
- Typing `2048` preserves the draft sequence and commits to `2048`.
- Clearing a focused field does not immediately reset to `1024`.
- Blurring an empty field falls back to the previous committed value.
- Blurring `2050` commits a multiple of 16.
- Values below `1024` clamp to `1024`, then the pair is rechecked.
- Values above `3824` clamp to `3824`, then the pair is rechecked.
- Extreme ratios such as `1024x3824` commit to a legal pair such as `1280x3824`.
- Width and height can be edited independently without rewriting the other field.

## Test Strategy

The project test runner executes JavaScript files in `tests/*.test.js`.
It does not directly import TypeScript UI modules. For this quick fix, tests
should follow the existing source-contract pattern:

- read `ui/src/lib/size.ts`, `ui/src/components/SizePicker.tsx`, and
  `ui/src/store/useAppStore.ts` as source text
- assert that risky patterns are gone
- assert that the intended helper/function names and input attributes exist
- use a mirrored JavaScript implementation inside the test file for edge-case
  examples such as `1024x3824 -> 1280x3824`

Focused local command:

```bash
node --test tests/size-custom-input-contract.test.js
```

Full regression command:

```bash
npm test
```

## Planned Files

- `ui/src/components/SizePicker.tsx`
- `ui/src/lib/size.ts`
- `ui/src/store/useAppStore.ts`
- `tests/size-custom-input-contract.test.js`

## Implementation Notes

- `SizePicker` now keeps `draftW` and `draftH` as local strings while typing.
- Custom inputs use `type="text"` with `inputMode="numeric"` and `pattern="[0-9]*"`.
- `onChange` updates only draft state; `onBlur` and `Enter` commit.
- Store-level `setCustomSize` uses `normalizeCustomSizePair` as a final guard.
- `.custom-size-input` uses `min-width: 0` so both inputs shrink inside the
  narrow right panel after switching from number inputs to text inputs.
- Contract tests were added in `tests/size-custom-input-contract.test.js`.

## Verification

Focused:

```bash
node --test tests/size-custom-input-contract.test.js
```

Result:

```text
tests 7
pass 7
fail 0
```

Follow-up render check:

```text
Custom row overflow=false
Width input: 2048 typed by keyboard
Height input: 3824 typed by keyboard
1024x3824 commits to 1280x3824
```
