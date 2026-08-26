# 005 — Audit round 2: synthesis and amendments

Same reviewer, re-verification round (AUDIT-LOOP-01). Verdict: **FAIL**, 2
blockers + 3 cleanups. Round 1's B4 confirmed closed.

Both blockers accepted. Round 1's fixes were right in direction and wrong in
mechanism — the reviewer found that in both cases I had put a guard in ONE
place when the state can arrive from several.

## R2-B1 — Sparse overrides, not a full persisted object (ACCEPTED)

**Claim.** The round-1 design cannot preserve per-field operator defaults:

- one object-level localStorage key cannot distinguish which *fields* the user
  touched;
- `saveNaiOptionsPatch` reloads-then-merges, so after server hydration the
  first user edit rewrites every untouched server-derived value back to the
  compiled fallback;
- `storeCapabilitiesImpl.ts` is the actual capability consumer and was missing
  from the wp2 file map;
- `syncCapabilities()` runs in an `App.tsx` effect **after** store creation, so
  a fast generation sends compiled fallbacks before the server answers;
- published `defaults.nai.model` has no consumer — `NaiOptions` has no `model`
  and provider-switch hardcodes V5 (`storeSettingsImpl.ts:383-388`).

**Verified.** All five. `syncCapabilitiesImpl` sets exactly one field
(`referenceLimit`) and swallows errors; `Ima2Capabilities`
(`ui/src/lib/api-capabilities.ts:3-8`) declares only `limits`; the
`syncCapabilities()` call site is `ui/src/App.tsx:100`, inside a mount effect.

The round-1 design was a resolution *order* without a state *shape* that could
express it. That is the real defect.

**Resolution — persist overrides only.**

```ts
export type NaiOptionOverrides = Partial<NaiOptions>;   // ONLY user-touched fields
```

`ima2.naiOptions` stores a **sparse** object. Resolution becomes a pure
function of three inputs, evaluated at read time rather than baked at hydration:

```ts
export function resolveNaiOptions(
  serverDefaults: Partial<NaiOptions> | null,
  overrides: NaiOptionOverrides,
): NaiOptions {
  return { ...COMPILED_FALLBACK, ...(serverDefaults ?? {}), ...overrides };
}
```

`setNaiOption(key, value)` writes **one key** into the overrides object.
Untouched fields have no entry, so they keep following the server — for the
lifetime of the install, not just until the first edit. `resetNaiOptions`
clears the overrides object, returning every field to operator configuration.

Store state holds `naiOptionOverrides` and `naiServerDefaults`;
`naiOptions` becomes a derived selector. The panel reads the resolved value and
writes overrides — the two directions are no longer the same object.

**Capability readiness.** `storeCapabilitiesImpl.ts` joins the wp2 file map and
sets `naiServerDefaults` alongside `referenceLimit`. Two consequences the plan
must state rather than hope about:

1. Until `syncCapabilities()` resolves, `naiServerDefaults` is `null` and the
   compiled fallback shows. That window is one fetch on app mount.
2. To close the window for real, **fields with no override are omitted from
   the payload entirely.** `naiPayloadFields` sends the overrides object, not
   the resolved object. An untouched field is then resolved by
   `lib/naiImageAdapter.ts:122-124` from `config.naiProvider` — the operator's
   value — regardless of whether capabilities arrived. The published defaults
   become a *display* concern only, which is the honest division: the server
   already owns resolution, and the client should never have been re-sending
   defaults it did not author.

That second point dissolves the race instead of racing it.

**`defaults.nai.model`.** Dropped from the published block. `NaiOptions` has no
`model` member, model selection flows through `imageModel` +
`normalizeNaiImageModel`, and publishing an unconsumed field invites exactly
the drift this audit is catching.

## R2-B2 — V5-only options must be gated at the boundary, not in a callback (ACCEPTED)

**Claim.** Resetting `straightAlpha` / `qualityPreset` in the model picker's
`onChange` does not hold. `imageModel` and the NAI options hydrate
independently, so a reload can produce V4.5 + stale `straightAlpha: true`;
`storeSettingsImpl.ts:485-489` sets a NAI model without going through the
panel; the payload helper sends both fields regardless of model; and the
adapter forwards them with no model guard (`lib/naiImageAdapter.ts:127-128`,
`:142`).

**Verified.** `setImageModelImpl` has an `isNaiImageModel(imageModel)` branch
that sets provider and model directly — the panel callback is not on that path.
Reload independence is inherent to two separate persisted keys.

The round-1 fix guarded the one path I happened to be looking at. Three others
exist.

**Resolution — defense at the boundary, with the UI reset kept as convenience.**

1. **Adapter (authoritative).** `generateViaNai` drops V5-only parameters for
   non-V5 models:

```ts
   const isV5 = model === "nai-diffusion-5-full" || model === "nai-diffusion-5-curated";
   // straight_alpha and qualityPresetId are V5 features. A V4.5 request
   // carrying them is stale client state, not intent.
```

   `straight_alpha` becomes `isV5 && options.straightAlpha === true`, and
   `qualityPresetId` is **pinned to `"standard"`** for V4.5.

   > Corrected in round 3: the first draft said "omitted entirely for V4.5,
   > restoring exactly today's wire body". Both halves cannot be true — the
   > adapter already sends `qualityPresetId` for every model (`:128`), so
   > omission WOULD change the V4.5 body. Pinning preserves the shape and still
   > removes all user influence. Canonical statement: `010`.

2. **Payload (early).** `naiPayloadFields` omits both keys unless the selected
   model is V5. Cheap, and keeps the wire body honest about intent.

3. **UI (convenience).** The panel still resets on model change so the control
   does not display a value that will be ignored.

Three layers because the state has three arrival paths. The adapter layer is
the one that must be right; the other two are for a coherent user experience.

**Test.** A contract case constructs the reviewer's exact scenario — hydrated
V4.5 model with persisted `straightAlpha: true` and `qualityPresetId: "light"`
— and asserts the wire body is identical to one that sent neither:
`straight_alpha === false`, `qualityPresetId === "standard"`.

## R2-C1 — Acceptance wording contradicts the Agent exclusion (ACCEPTED)

`010`'s criterion 4 said "no NAI dispatch site builds options by hand", which
the deliberate Agent exclusion violates by design. Corrected to "no
**request-driven** NAI dispatch site".

## R2-C2 — History metadata needs a provider guard (ACCEPTED)

`composerNegativePrompt` gated on non-empty only would let any non-NAI API
caller write the field into history metadata. Corrected to require
`activeProvider === "nai"` **and** non-empty.

## R2-C3 — `coerceNaiOptions` was undefined (ACCEPTED)

`020` named `isNaiOptions` in the file map and used `coerceNaiOptions` in the
pseudocode. Under the sparse-override redesign the real API is:

```ts
export function coerceNaiOverrides(value: unknown): NaiOptionOverrides;
```

Per-key validation: a key survives only if present AND valid for its alphabet
or range; anything else is dropped from the overrides object, which means that
field falls back to the server default rather than to a compiled constant. One
corrupt key cannot discard the other nine, and a dropped key degrades toward
the operator's configuration — the right direction.

## Net effect

| Doc | Change |
|---|---|
| `010` | `defaults.nai` drops `model`; adapter gains V5 gating for `straight_alpha`/`qualityPresetId`; criterion 4 reworded; history metadata provider-gated |
| `020` | Sparse-override state model; `resolveNaiOptions`; payload sends overrides only; `storeCapabilitiesImpl.ts` added; `coerceNaiOverrides` defined |
| `030` | Panel reads resolved / writes overrides; model-change reset demoted to convenience |
| `003` | The "cannot disagree" claim corrected — persistence can disagree; the boundary guard is what makes it safe |

Both rounds followed the same pattern: a correct instinct implemented in one
place when the state has several entrances. Worth recording, because the third
round of it would be a plan problem rather than a review finding.
