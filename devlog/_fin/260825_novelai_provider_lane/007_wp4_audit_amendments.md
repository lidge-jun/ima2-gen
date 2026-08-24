# 007 — wp4 A-phase audit disposition

The reviewer audited HEAD `908fbf3f`, which predated the UI commits made in
the same phase. Three of its findings were therefore **already implemented**
when it reported; two were real and new. Every one was checked against the
working tree before being accepted or set aside — a stale-snapshot finding is
still worth verifying, because "I already did that" is exactly the claim an
audit exists to test.

## Already implemented when reported (verified, not dismissed)

| Finding | Status in tree |
|---------|----------------|
| W4-H1 provider-switch coercion | `isNaiImageModel` exists; `setProviderImpl` has the `nai` arm; the reset guard and `setImageModelImpl` both handle it. Pinned by `nai-ui-registration-contract`. |
| W4-H2 tray still allows references | `effectiveReferenceLimit` returns 0 for `nai` via `LANES_WITHOUT_REFERENCE_SUPPORT`. |
| W4-H3 availability Record missing `nai` | `useKeyStatus` union and `useProviderAvailability` both carry `nai`; the UI build passes. |

The reviewer's H2 remediation suggested deriving the no-reference set from an
empty `referenceLimits`. **Rejected on evidence:** `oauth` and `api` are also
empty there and legitimately defer to the server's `maxRefCount`, so deriving
it would have silently disabled attachments on the two largest lanes. An empty
manifest entry means "no lane-specific cap", not "no references accepted". The
shipped set is explicit, and the contract test asserts the derivation is NOT
used.

## W4-N1 (ACCEPTED, new) — `NAI_*` refusals had no UI text

`ui/src/lib/errorCodes.ts` had no entry for `NAI_REF_UNSUPPORTED` or
`NAI_EDIT_UNSUPPORTED`, both of which wp3 actually throws. Without a mapping
the user gets an unclassified failure instead of an explanation. Added to the
`ImaErrorCode` union and the registry, with toast keys in all four locales.

## W4-N2 (ACCEPTED, new) — the i18n oracle has TWO copies

`tests/i18n-dictionary-contract.test.ts` lists the model-label keys twice
(L81 for settings, L97 for `ProviderReadinessPopup`). Updating only the first
would leave the second stale. Both now carry the four `naiDiffusion*` keys.
This is the kind of duplication that a single `rg` hit hides.

## W4-N3 (ACCEPTED, new) — canvas edit was not provider-gated

`useCanvasModeSession` has two `postEdit` call sites. The transparency helper
already pins itself to the OAuth lane, but the annotate/apply path forwards the
workspace provider, so a canvas edit under NovelAI would have round-tripped to
a guaranteed `NAI_EDIT_UNSUPPORTED`. Now refused client-side with the toast.

## Corrected in my own earlier work

`040`'s stale check claimed `storeHelpers.ts:345` was the reference guard. It
is `getCustomSizeConfirmation`, the custom-size dialog. The reviewer was right
to call the comment false; it has been rewritten to describe what the function
does. Adding `nai` there is still correct (its sizes are fixed presets), but it
never had anything to do with attachments.

## Doctor: verify-only, as planned

`ima2 doctor` prints `⚠ nai: api-key unset` through the generic
`credential.validateUrl` path. No `keyVocabulary === "nai"` branch was added —
`040` said verify first, and the verification said no branch is needed.
