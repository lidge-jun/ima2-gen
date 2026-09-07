# 030 wp3 — issue #193: NAI V5 Opus battery in the quota lane, 402 split (C3)

Source of truth for facts: issue #193 body (FAQ + live measurements). Branch
`codex/p314-wp3-nai-quota` from origin/dev after wp1 merges.

## Contract
- GET https://image.novelai.net/user/subscription with `Authorization: Bearer <token>`
  and the same non-browser header set the generation POST uses (none beyond auth +
  content-type today; keep parity, do not invent Origin/Referer). Host from
  `config.naiProvider.accountBaseUrl` (config.ts:434, default image.novelai.net).
- Parse defensively: `active` (boolean), `tier` (number), a `usage`-like object found by
  scanning the subscription object for the first nested object with numeric `percent`
  (issue notes the key moved once), `trainingStepsLeft.fixedTrainingStepsLeft` and
  `purchasedTrainingSteps` (numbers, default 0).
- No PII: never read/forward email, user id, token, or the raw body.

## File change map
### NEW lib/naiSubscription.ts (~90 lines)
```ts
export interface NaiSubscriptionSnapshot {
  active: boolean; tier: number | null;
  battery: { percent: number; isNegative: boolean; timeUntilNextPercentSec: number | null } | null;
  anlas: { fixed: number; purchased: number };
}
export function parseNaiSubscription(value: unknown): NaiSubscriptionSnapshot | null;
export async function fetchNaiSubscription(ctx, opts?: { signal?: AbortSignal; timeoutMs?: number }):
  Promise<{ ok: true; snapshot } | { ok: false; status: 401 | "error" }>;
export function isNaiBatteryModel(model: string): boolean; // nai-diffusion-5-*
export function naiBatteryExhausted(s: NaiSubscriptionSnapshot): boolean; // isNegative || percent <= 0
export function naiAnlasAvailable(s): boolean; // fixed + purchased > 0
```
### MODIFY lib/naiImageAdapter.ts (402 branch, lines 213-219)
Before:
```ts
if (res.status === 402) { throw naiError(`NovelAI requires an active subscription: ${detail}`, 402, "NAI_SUBSCRIPTION_REQUIRED"); }
```
After:
```ts
if (res.status === 402) throw await classifyNai402(ctx, model, detail, combinedSignal);
```
with `classifyNai402` in lib/naiSubscription.ts: if `isNaiBatteryModel(model)`, probe
subscription once (bounded 5s); when `active === true && batteryExhausted && !anlasAvailable`
return naiError(..., 402, "NAI_USAGE_EXHAUSTED"); otherwise (probe failed, inactive,
V4.5 model) keep NAI_SUBSCRIPTION_REQUIRED. Activation: tests stub fetch with two
responses (generate 402, then subscription JSON).
Also: on success, populate `usage` with `{ naiBatteryPercent }` only when a snapshot was
taken (no extra request by default: leave `usage: null`; the issue asks for optional
pre/post probes; we keep generation single-request and expose the meter via /api/quota).
### MODIFY lib/errors/providerMap.ts:41 add `NAI_USAGE_EXHAUSTED: "BILLING_REQUIRED"`.
### MODIFY ui/src/lib/errorCodes.ts: add union member, spec
`NAI_USAGE_EXHAUSTED: { surface: "card", cardKey: "errorCard.naiUsageExhausted", cta: "dismiss" }`,
and append to SELF_DESCRIBING_AUTH_CODES (line 217-222).
### MODIFY ui/src/i18n/{en,ko,zh-Hans,zh-Hant}.json
- `errorCard.naiUsageExhausted` { title, body } next to naiSubscriptionRequired (line ~1628).
- `settings.quota.naiBattery` "V5 battery", `settings.quota.naiAnlas` "Anlas",
  `settings.quota.naiNegative` "Recharging (negative)", `settings.quota.naiNextPercent` "+1% in {minutes} min",
  `settings.account.naiTitle` "NovelAI", `settings.account.naiEyebrow` "Token", `settings.account.naiBody`.
### MODIFY routes/quota.ts
- NEW `fetchNaiQuota(ctx): Promise<QuotaResult>`: no key -> `{ provider: "nai", authenticated: false, windows: [] }`;
  401 -> authenticated false; other failure -> `error: true`; success ->
  `{ provider: "nai", account: { email: null, plan: active ? `Tier ${tier}` : "inactive" },
     windows: [{ label: "v5-battery", percent, resetsAt: now + timeUntilNextPercent*1000 or null }],
     nai: { isNegative, anlasFixed, anlasPurchased, active } }`.
  Extend `QuotaResult` with optional `nai?: {...}` (routes/quota.ts:14) — field chain:
  creation routes/quota.ts -> JSON -> ui QuotaCard.tsx QuotaResult interface (line 12) -> NaiQuota consumer.
- registerQuotaRoutes: `Promise.all([codex, grok, fetchNaiQuota(ctx)])`, respond `{ codex, grok, nai }`.
  ctx param currently `_ctx`; use it (RouteRuntimeContext must expose naiApiKey; it does via RuntimeContext).
### MODIFY ui/src/components/settings/QuotaCard.tsx
- QuotaResponse gains `nai?: QuotaResult`; QuotaResult gains `nai?` block.
- NEW export `NaiQuota({ data, loading })`: header "Tier N", battery bar via QuotaBar
  (label from i18n), a line "Anlas: fixed + purchased", negative flag. No SwitchAccount.
### MODIFY ui/src/components/AccountSettings.tsx
- After the Grok card (line ~121) add a NovelAI provider-card rendered when
  `keyStatus.nai?.configured`, containing `<NaiQuota .../>`.
### MODIFY docs/API.md:157 `/api/quota` row -> `{ codex, grok, nai }` + window names.
### MODIFY structure/03-server-api.md:677 add NAI_USAGE_EXHAUSTED; structure/04-frontend-architecture.md:181 "15" -> "16" codes.
### MODIFY CHANGELOG Unreleased ### Added.
### NEW tests/nai-subscription-contract.test.ts
- parse fixture from the issue; key-moved fixture (`usage` nested one level deeper); no-PII (result has no email/id keys).
- fetchNaiQuota: 401 -> authenticated:false; 500 -> error:true; success windows.
- 402 split: stub fetch sequence [402 generate, subscription active+isNegative+anlas 0] -> NAI_USAGE_EXHAUSTED;
  [402, active:false] -> NAI_SUBSCRIPTION_REQUIRED; V4.5 model 402 -> NAI_SUBSCRIPTION_REQUIRED with no second fetch (assert calls.length===1).
- Update tests/nai-routing-contract.test.ts:117, tests/nai-ui-registration-contract.test.ts:168, tests/node-error-info-contract.test.ts:25 code lists.
### CLI: `ima2 billing` (bin/commands/observability.ts) prints /api/quota; add nai rows when present (label + percent + anlas). Verify with `node dist/bin/ima2.js billing --json` against a fixture server in tests if an existing CLI billing test exists (`rg -n billing tests/cli-*.test.ts`); otherwise unit test the formatter only.

## Verifiers
- `npm test` (new file globbed by scripts/run-tests.mjs), `npm run typecheck`, `npm run typecheck:tests`, `npm run test:inventory` (classify-tests registry must include new test), `npm --prefix ui run build`, `tests/api-docs-contract.test.js` (reads docs/API.md), i18n parity test (`rg -n i18n tests | head` -> tests/i18n-*.test.* must pass with new keys).
- Visual: Computer-use browser on local dev server with a stub NAI key + fetch interception is not possible server-side; instead run the server with `IMA2_NAI_ACCOUNT_BASE_URL=http://127.0.0.1:<fixture>` serving the fixture JSON, open Settings, screenshot the NovelAI card.

## Accept: c-4; close #193 with the criteria table and test names.

