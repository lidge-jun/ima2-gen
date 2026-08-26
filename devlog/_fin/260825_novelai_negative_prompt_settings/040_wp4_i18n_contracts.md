# 040 — wp4: i18n and contract test closure

Depends on wp3 (`030`): the key list is knowable only once the controls exist.

Independently verifiable at close: `npm test` = `fail 0` including
`i18n-dictionary-contract`.

## Deliverable

Every new string in all four locales, and the contract tests updated to hold
the new surface.

## Locale files

`ui/src/i18n/en.json`, `ko.json`, `zh-Hans.json`, `zh-Hant.json` — **four**,
and `tests/i18n-dictionary-contract.test.ts:367-371` fails on a leaf present in
one and missing in another. Partial translation is a build failure.

## Key layout

A new top-level `nai` namespace rather than nesting under `settings`: the
undesired-content field lives in the composer, not settings, so
`settings.nai.*` would misfile half the keys.

```
nai.negativePrompt.label
nai.negativePrompt.placeholder
nai.negativePrompt.hint
nai.panel.modelTitle
nai.panel.sizeTitle
nai.panel.samplingTitle
nai.panel.presetTitle
nai.panel.outputTitle
nai.field.sampler
nai.field.noiseSchedule
nai.field.steps
nai.field.scale
nai.field.cfgRescale
nai.field.ucPreset
nai.field.qualityPreset
nai.field.varietyPlus
nai.field.straightAlpha
nai.field.seed
nai.field.seedRandom
nai.help.varietyPlus
nai.help.straightAlpha
nai.help.cfgRescale
nai.help.seed
nai.size.portrait
nai.size.landscape
nai.size.square
nai.ucPreset.heavy
nai.ucPreset.light
nai.ucPreset.furryFocus
nai.ucPreset.humanFocus
nai.ucPreset.none
nai.qualityPreset.standard
nai.qualityPreset.light
nai.qualityPreset.none
nai.compatTitle
nai.compatBody
```

Sampler and noise-schedule values stay untranslated: `k_dpmpp_2m_sde` and
`karras` are identifiers users match against NovelAI's own UI. Translating them
would break recognition.

## Copy (English)

| Key | Text |
|---|---|
| `negativePrompt.label` | Undesired content |
| `negativePrompt.placeholder` | lowres, bad anatomy, watermark… |
| `negativePrompt.hint` | Tags to steer away from. Combines with the preset below. |
| `field.varietyPlus` | Variety+ |
| `help.varietyPlus` | Adds diversity to compositions at high guidance. |
| `field.straightAlpha` | Transparent background |
| `help.straightAlpha` | V5 native alpha. Pair with a transparent-background tag in the prompt. |
| `field.cfgRescale` | CFG rescale |
| `help.cfgRescale` | Softens over-saturation at high guidance. 0 disables it. |
| `field.seed` | Seed |
| `help.seed` | Leave empty for a new seed every time. |
| `compatTitle` | NovelAI lane |
| `compatBody` | Text-to-image only. Reference images, editing, and batch counts are not available on this lane. |

"Undesired content" is NovelAI's own term (001). Using "negative prompt" would
be the API word where the product word is clearer.

### Korean

Plain, no translationese: "원하지 않는 요소", "네거티브 프롬프트" only where the
term is genuinely the recognized one. Helper text in a consistent register —
"…합니다" throughout, no mixed politeness levels.

## Contract test updates

**`tests/i18n-dictionary-contract.test.ts` needs NO edit** (corrected by
`004` §B5 — the original two instructions would each have manufactured a
failure):

- `LEGACY_DOTTED_ROOTS` is at `:29` and holds keys that *literally contain a
  dot* (`"assets.clearAll"`, `"assets.clearConfirm"`). The test at `:374-378`
  asserts the dotted root set is **exactly** that pair. Adding an ordinary
  nested root `nai` would fail it immediately.
- Template keys are auto-resolved: `resolveTranslationExpression` routes
  `ts.isTemplateExpression` through `templateNamespace` (`:296-323`) and
  records the namespace. `DYNAMIC_T_IDENTIFIERS` is for non-template dynamic
  expressions, which these are not.

The only real obligation is four-locale leaf parity, already enforced at
`:367-371`. Writing the keys into all four files IS the work.

`tests/nai-ui-registration-contract.test.ts`: the i18n-readiness case from wp3
turns green here; add a case asserting every `NAI_UI_UC_PRESETS` /
`NAI_UI_QUALITY_PRESETS` member has a label in all four locales.

## Accept criteria

1. `npm test` = `fail 0`, `i18n-dictionary-contract` included.
2. All four locale files have identical leaf sets under `nai`.
3. No `t()` call in the new components resolves to a raw key.

## Scope boundary

IN: locale files, the two contract tests, and copy-only component edits. OUT:
new controls; any behavior change.
