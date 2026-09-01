# 020 — Configurable Prompt Builder backend (wp3)

## Loop specification

- Loop archetype: spec-satisfaction.
- Goal: make Prompt Builder choose an explicit, persisted text backend; make `auto`
  selection observable in logs and in the right-sidebar UI; reject unavailable explicit
  backends with typed errors; keep model choices valid for the selected backend.
- Non-goals: changing the active image-generation provider, retrying a submitted request
  against a second billable backend, adding a new Gemini text adapter, changing the Prompt
  Builder system prompt, changing attachment limits, or redesigning Settings navigation.
- Verifier: focused Prompt Builder contract tests, `npm run typecheck`,
  `npm run typecheck:tests`, `npm test`, `npm run test:inventory`,
  `cd ui && npm run build`, and 1280x720 browser evidence against a fresh
  `node bin/ima2.js serve` on a spare port.
- Stop condition: all field-chain links, router branches, config persistence, typed
  errors, backend-aware menus, visible `via <backend>` evidence, locale parity, and the
  five repository verifier commands pass with fresh output.
- Escalation: any provider other than OAuth, OpenAI API, progrok, and xAI API requires
  a proven text adapter before entering this diff. Locale scope is settled at the four
  runtime locales (000_plan.md "Locale correction"); Japanese is a non-goal.

## 1. Grounded baseline

1. The route only exposes `POST /api/prompt-builder/chat` and forwards the body to one
   client (`routes/promptBuilder.ts:7-18`). Its error envelope already preserves a typed
   `code` and HTTP `status` (`routes/promptBuilder.ts:19-33`).
2. The client normalizes one GPT-only model, waits for OAuth, and constructs every URL
   from `ctx.oauthUrl` (`lib/promptBuilder/client.ts:21-50`). Successful responses hard-code
   `provider: "oauth"` (`lib/promptBuilder/client.ts:109-116`).
3. Model validation is one global set (`lib/promptBuilder/constants.ts:1-2`,
   `lib/promptBuilder/requestSchema.ts:11-19`), and the sidebar duplicates that list
   (`ui/src/components/prompt-builder/PromptBuilderModelMenu.tsx:5-6`).
4. The UI store sends its local model on every request and records neither the actual
   backend nor fallback metadata (`ui/src/store/promptBuilderStore.ts:75-85,107-159`).
   The response DTO already has a generic `provider: string`, so adding a specific
   `backend` field is backward-compatible (`ui/src/lib/api-generation.ts:228-233`).
5. Existing OpenAI text paths prove both direct API and OAuth Responses transport:
   direct API requires `ctx.apiKey` and targets `https://api.openai.com/v1/responses`,
   while OAuth targets `ctx.oauthUrl` (`lib/agentPlannerModel.ts:135-172`). The shared
   question responder confirms that Responses text may arrive as SSE and already parses
   both SSE and JSON (`lib/agentQuestionResponder.ts:109-156`).
6. Existing Grok text transport calls `/v1/chat/completions` through
   `getGrokEndpoint` (`lib/agentPlannerModel.ts:109-132`). That endpoint helper already
   switches between progrok and direct xAI when a key is supplied
   (`lib/grokImageCore.ts:62-73`), and the Grok planner proves image content parts on
   chat messages (`lib/grokImageAdapter.ts:147-169,330-352`).
7. There is no reusable Gemini text-chat adapter. The only `generateContent` calls are
   image-generation calls in `lib/geminiApiImageAdapter.ts:124-146`; therefore Gemini is
   deliberately excluded instead of inventing a fourth protocol in this cycle.
8. Runtime configuration precedence is env > `${IMA2_CONFIG_DIR}/config.json` > default
   and the file is loaded once at import (`./config.ts:7-9,35-58`). `pickStr` is the existing
   string projection (`./config.ts:60-83`). Writable key and env mappings are centralized
   in `lib/configKeys.ts:3-65`.
9. The nearest settings route pattern is GET plus validating mutation in
   `routes/capabilities.ts:33-45`, but it only mutates memory. Prompt Builder must add an
   atomic file write. The existing atomic, serialized writer currently lives privately
   in `routes/keys.ts:7-33`, so this design extracts and reuses it rather than duplicating
   config-file mutation.
10. Backend readiness already has one source of truth: `buildLaneSummary`
    (`routes/models.ts:488-550`). OAuth, OpenAI API, progrok, and xAI API statuses are
    derived at `routes/models.ts:115-130,143-185`; Prompt Builder must consume those
    statuses rather than derive a second readiness model.
11. The settings screen uses `settings.*`, and provider controls are rows inside the
    existing Providers section (`ui/src/components/SettingsWorkspace.tsx:189-256`). The
    shared `Select` supports `disabled` and portaling (`ui/src/components/controls/Select.tsx:29-52`).
12. Locale parity is enforced by flattening all keys and comparing en, ko, zh-Hant, and
    zh-Hans (`tests/i18n-coverage-contract.test.ts:53-65`). This checkout does not contain
    `ui/src/i18n/ja.json`; Japanese is absent from imports, `Locale`, dictionaries, and
    supported-locale checks (`ui/src/i18n/index.ts:1-9,62-77`).

## 2. Contract decision

### 2.1 Persisted shape and model catalog

The persisted shape is exactly:

```json
{
  "promptBuilder": {
    "backend": "auto",
    "model": "auto"
  }
}
```

Allowed backends are `auto | oauth | api | grok | grok-api`. `model: "auto"` is only
valid when `backend: "auto"`; it means “use the selected lane's default.” A single model
cannot be valid across GPT and Grok, so storing a GPT slug beside `backend: "auto"` would
make fallback impossible or silently rewrite user intent.

Explicit-model rule under `backend: "auto"` (request-time only, never persisted): when a
chat request carries a concrete model slug while the configured backend is `auto`,
`normalizeRequestModel("auto", slug)` resolves the slug through the catalog and
the selector restricts the auto order to lanes whose catalog contains it (GPT slugs ->
`oauth`, `api`; Grok slugs -> `grok`, `grok-api`). An unknown slug still returns
`PROMPT_BUILDER_BAD_MODEL`. This keeps the existing CLI example
`ima2 prompt build --messages @conversation.json --model gpt-5.5`
(`bin/commands/prompt-sub/build.ts:24`) working unchanged under the default config,
and the CLI additionally gains `--backend <auto|oauth|api|grok|grok-api>` as a
per-request override (see 4.2).

| Backend | Models, in menu order | Default |
|---|---|---|
| `auto` | `auto` | `auto` |
| `oauth` | `gpt-5.6-luna`, `gpt-5.6-terra`, `gpt-5.6-sol`, `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini` | `gpt-5.6-luna` |
| `api` | same GPT list | `gpt-5.6-luna` |
| `grok` | `grok-4.3`, `grok-4.6`, `grok-4.5` | `grok-4.3` |
| `grok-api` | same Grok list | `grok-4.3` |

The Grok default and choices match the existing planner configuration
(`./config.ts:20-33`). Do not expose image-model slugs in this text-model menu.

Environment overrides are `IMA2_PROMPT_BUILDER_BACKEND` and
`IMA2_PROMPT_BUILDER_MODEL`. GET reports per-field `locked` booleans. PUT returns typed
409 `PROMPT_BUILDER_CONFIG_ENV_LOCKED` instead of pretending a file write can override
an active environment variable.

### 2.2 Auto order, readiness, and failure semantics

`auto` order is:

```text
oauth -> grok -> api -> grok-api
```

This preserves today's OAuth behavior first, then prefers the other signed-in local
lane, then direct billable keys. Readiness comes from `buildLaneSummary`; only
`status === "ready"` is selectable.

| Requested path | Condition | Result |
|---|---|---|
| explicit `oauth` | not ready | 503 `PROMPT_BUILDER_OAUTH_UNAVAILABLE` |
| explicit `api` | key missing/not ready | 401 `PROMPT_BUILDER_API_KEY_REQUIRED` |
| explicit `grok` | not ready | 503 `PROMPT_BUILDER_GROK_UNAVAILABLE` |
| explicit `grok-api` | key missing/not ready | 401 `PROMPT_BUILDER_XAI_KEY_REQUIRED` |
| `auto` | no ready lane | 503 `PROMPT_BUILDER_NO_BACKEND_READY` |
| `auto` | selected lane is not OAuth | select first ready lane; emit one fallback log |

The fallback log is:

```ts
logEvent("prompt-builder", "backend_fallback", {
  requestedBackend: "auto",
  from: "oauth",
  to: selection.backend,
  reason: lanes.oauth?.reason || lanes.oauth?.status || "not-ready",
});
```

There is no retry after an upstream accepts a request. A readiness fallback happens
before submission; network/429/5xx errors from the selected lane remain typed errors.
This avoids duplicate model spend and makes `auto` deterministic.

### 2.3 Response and UI observability

Every successful chat response includes both compatibility and explicit fields:

```ts
{
  provider: resolvedBackend,
  backend: resolvedBackend,
  requestedBackend,
  model,
  message,
  usage
}
```

The store writes `result.backend` to `lastBackend`. The panel renders the badge only
after a successful response, so `via Grok` means a request actually completed through
Grok, not merely that Grok was selected. Explicit failures stay visible as an alert in
the message list and never update the badge.

## 3. PLAN-FIELD-CHAIN-01

| Field | Creation | Serialization | Deserialization | Consumers |
|---|---|---|---|---|
| `promptBuilder.backend` | defaults/catalog in `lib/promptBuilder/constants.ts`; env/file/default projection in `config.ts` | PUT route calls shared atomic config mutation and writes `promptBuilder.backend` | `config.ts` reads `fileCfg.promptBuilder?.backend` through `pickStr`; request-schema validates again at HTTP boundary | GET payload, backend selector, transport router, Settings backend select, builder model menu, chat result `requestedBackend`, CLI requests without override |
| `promptBuilder.model` | per-backend default/catalog in `lib/promptBuilder/constants.ts`; normalized together with backend | same atomic PUT writes `promptBuilder.model` | `config.ts` projects env/file/default; `normalizePromptBuilderModel(backend, value)` rejects cross-backend slugs | transport payload, Settings model select, sidebar model select, optional CLI `--model`, response badge metadata/tests |
| `PromptBuilderChatResult.backend` | transport selector resolves it before submission | JSON response from `POST /api/prompt-builder/chat` | `jsonFetch` into `PromptBuilderChatResponse` | `promptBuilderStore.lastBackend`, visible `via <backend>` badge |
| `locked.backend/model` | GET route checks corresponding env vars | config response only; never persisted | UI store loads it | disables Settings controls and shows env-managed copy |
| store `backend`, `model` (ui) | initial `auto`/`auto` in `promptBuilderStore`; hydrated by `loadConfig` from GET | `updateConfig` -> PUT body `{backend, model}` | GET/PUT JSON -> store via `jsonFetch`; rollback to previous pair on PUT failure | `PromptBuilderModelMenu`, Settings section, `sendMessage` request body (only after `configLoaded`) |
| store `modelOptions`, `backendOptions` (ui) | from GET `options.models[backend]` / `options.backends` | never persisted | replaced on every successful GET/PUT | model `Select` items, Settings backend `Select` items |
| store `configLoaded`, `configLoading` (ui) | `loadConfig` sets loading true, loaded true on success | never persisted | reset only on remount | `PromptBuilderComposer` send button `disabled` until `configLoaded`; Settings shows skeleton while loading |
| store `lastBackend` (ui) | `sendMessage` success sets `result.backend` | never persisted | cleared by `clear()` | `via <backend>` badge in `PromptBuilderPanel` |
| store `locked` (ui) | from GET `locked` | never persisted | replaced on GET | disables Settings controls; env-managed copy |

Changing backend resets model to that backend's default in one PUT. PUT always validates
the pair before writing, writes both fields in one serialized atomic mutation, then
hot-updates `ctx.config.promptBuilder`; no restart is required for UI-originated changes.
At process restart, env/file/default projection recreates the same pair.

## 4. Diff-level implementation map

### 4.1 Backend/config files

#### MODIFY `lib/promptBuilder/constants.ts`

Replace the current two model constants at `lib/promptBuilder/constants.ts:1-2` with:

```diff
-export const VALID_PROMPT_BUILDER_MODELS = new Set(["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol", "gpt-5.5", "gpt-5.4", "gpt-5.4-mini"]);
-export const DEFAULT_PROMPT_BUILDER_MODEL = "gpt-5.6-luna";
+export const PROMPT_BUILDER_BACKENDS = ["auto", "oauth", "grok", "api", "grok-api"] as const;
+export type PromptBuilderBackend = (typeof PROMPT_BUILDER_BACKENDS)[number];
+export type ResolvedPromptBuilderBackend = Exclude<PromptBuilderBackend, "auto">;
+
+const GPT_MODELS = ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol", "gpt-5.5", "gpt-5.4", "gpt-5.4-mini"] as const;
+const GROK_MODELS = ["grok-4.3", "grok-4.6", "grok-4.5"] as const;
+
+export const PROMPT_BUILDER_MODELS: Record<PromptBuilderBackend, readonly string[]> = {
+  auto: ["auto"],
+  oauth: GPT_MODELS,
+  grok: GROK_MODELS,
+  api: GPT_MODELS,
+  "grok-api": GROK_MODELS,
+};
+export const DEFAULT_PROMPT_BUILDER_MODELS: Record<PromptBuilderBackend, string> = {
+  auto: "auto",
+  oauth: "gpt-5.6-luna",
+  grok: "grok-4.3",
+  api: "gpt-5.6-luna",
+  "grok-api": "grok-4.3",
+};
+export const PROMPT_BUILDER_AUTO_ORDER: readonly ResolvedPromptBuilderBackend[] = [
+  "oauth", "grok", "api", "grok-api",
+];
 export const MAX_MESSAGES = 24;
```

#### MODIFY `config.ts`

Import the catalog, normalize invalid file/env combinations to the selected backend's
default, and add the config block after `oauth`:

```diff
 import { deriveSupportedImageModels, deriveUnsupportedImageModels } from "./lib/providers/derive.js";
+import {
+  DEFAULT_PROMPT_BUILDER_MODELS,
+  PROMPT_BUILDER_BACKENDS,
+  PROMPT_BUILDER_MODELS,
+  type PromptBuilderBackend,
+} from "./lib/promptBuilder/constants.js";
@@
 function pickBool(envVal: Pickable, fileVal: Pickable, fallback: boolean): boolean {
@@
 }
+function promptBuilderBackend(raw: string): PromptBuilderBackend {
+  return PROMPT_BUILDER_BACKENDS.includes(raw as PromptBuilderBackend)
+    ? raw as PromptBuilderBackend
+    : "auto";
+}
+const selectedPromptBuilderBackend = promptBuilderBackend(
+  pickStr(env.IMA2_PROMPT_BUILDER_BACKEND, fileCfg.promptBuilder?.backend, "auto"),
+);
+const selectedPromptBuilderModel = pickStr(
+  env.IMA2_PROMPT_BUILDER_MODEL,
+  fileCfg.promptBuilder?.model,
+  DEFAULT_PROMPT_BUILDER_MODELS[selectedPromptBuilderBackend],
+);
@@
   oauth: {
@@
   },
+  promptBuilder: {
+    backend: selectedPromptBuilderBackend,
+    model: PROMPT_BUILDER_MODELS[selectedPromptBuilderBackend].includes(selectedPromptBuilderModel)
+      ? selectedPromptBuilderModel
+      : DEFAULT_PROMPT_BUILDER_MODELS[selectedPromptBuilderBackend],
+  },
```

#### MODIFY `lib/configKeys.ts`

```diff
 export const WRITABLE_CONFIG_KEYS = new Set([
+  "promptBuilder.backend",
+  "promptBuilder.model",
@@
 export const KEY_TO_ENV: Record<string, string> = {
+  "promptBuilder.backend": "IMA2_PROMPT_BUILDER_BACKEND",
+  "promptBuilder.model": "IMA2_PROMPT_BUILDER_MODEL",
```

#### NEW `lib/configFileStore.ts`; MODIFY `routes/keys.ts`

Move, without behavior changes, the writer currently at `routes/keys.ts:7-33` into this
new shared owner. Add `mkdir(dirname(cfgPath), { recursive: true, mode: 0o700 })` before
the temporary write. The complete new file is:

```ts
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

let configMutationQueue: Promise<void> = Promise.resolve();

function serializeConfigMutation<T>(mutation: () => Promise<T>): Promise<T> {
  const result = configMutationQueue.then(mutation, mutation);
  configMutationQueue = result.then(() => undefined, () => undefined);
  return result;
}

async function writeConfigAtomic(cfgPath: string, data: unknown): Promise<void> {
  const tmp = `${cfgPath}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`;
  try {
    await mkdir(dirname(cfgPath), { recursive: true, mode: 0o700 });
    await writeFile(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
    await rename(tmp, cfgPath);
  } catch (error) {
    throw error;
  }
}

export async function updateConfigFileAtomic(
  cfgPath: string,
  mutate: (config: Record<string, unknown>) => void,
): Promise<void> {
  try {
    await serializeConfigMutation(async () => {
      let existing: Record<string, unknown> = {};
      try {
        existing = JSON.parse(await readFile(cfgPath, "utf8")) as Record<string, unknown>;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "ENOENT") {
          // Never overwrite a file we could not parse: that would erase API keys and
          // every unrelated setting. Surface it; the PUT route maps this to 500
          // PROMPT_BUILDER_CONFIG_UNREADABLE.
          throw Object.assign(new Error(`config file unreadable: ${cfgPath}`), { code: "CONFIG_UNREADABLE", cause: error });
        }
        // ENOENT only: a brand-new config file is created from the mutation.
      }
      mutate(existing);
      await writeConfigAtomic(cfgPath, existing);
    });
  } catch (error) {
    throw error;
  }
}
```

`routes/keys.ts` removes its local `writeConfigAtomic`, queue, serializer, and
`updateConfigFile`, imports `updateConfigFileAtomic`, and replaces its five
`updateConfigFile(` calls with `updateConfigFileAtomic(`. This is required reuse, not a
Prompt Builder copy of secret-bearing file-write logic.

#### MODIFY `lib/promptBuilder/types.ts`

```diff
+import type {
+  PromptBuilderBackend,
+  ResolvedPromptBuilderBackend,
+} from "./constants.js";
@@
 export type PromptBuilderChatResult = {
-  provider: "oauth";
+  provider: ResolvedPromptBuilderBackend;
+  backend: ResolvedPromptBuilderBackend;
+  requestedBackend: PromptBuilderBackend;
   model: string;
@@
 };
@@
 export type PromptBuilderRequest = {
+  backend?: unknown | undefined; // per-request override (CLI --backend); never persisted
   model?: unknown | undefined;
   messages?: unknown | undefined;
   context?: PromptBuilderContext | undefined;
 };
+
+export type PromptBuilderConfig = { backend: PromptBuilderBackend; model: string };
+export type PromptBuilderLaneSummary = Record<string, {
+  status: "ready" | "locked" | "disconnected" | "key-missing";
+  reason?: string;
+}>;
```

#### MODIFY `lib/promptBuilder/requestSchema.ts`

Replace global `normalizeModel(raw)` with backend-scoped validation and add config-pair
validation. Replace that function with these complete functions:

```ts
export function normalizePromptBuilderBackend(
  raw: unknown,
  fallback: PromptBuilderBackend = "auto",
): PromptBuilderBackend {
  if (raw === undefined || raw === null || raw === "") return fallback;
  if (typeof raw === "string" && PROMPT_BUILDER_BACKENDS.includes(raw as PromptBuilderBackend)) {
    return raw as PromptBuilderBackend;
  }
  throw promptBuilderError(
    `backend must be one of: ${PROMPT_BUILDER_BACKENDS.join(", ")}`,
    "PROMPT_BUILDER_BAD_BACKEND",
  );
}

/**
 * Persisted-pair validation (config file, PUT route): STRICT. Under backend "auto" the
 * only legal stored model is "auto"; a concrete slug beside "auto" is rejected so the
 * pair can never be persisted, hot-applied, then silently reset on restart.
 */
export function normalizePromptBuilderModel(
  backend: PromptBuilderBackend,
  raw: unknown,
): string {
  const candidate = typeof raw === "string" && raw.trim()
    ? raw.trim()
    : DEFAULT_PROMPT_BUILDER_MODELS[backend];
  if (!PROMPT_BUILDER_MODELS[backend].includes(candidate)) {
    throw promptBuilderError(
      `model for ${backend} must be one of: ${PROMPT_BUILDER_MODELS[backend].join(", ")}`,
      "PROMPT_BUILDER_BAD_MODEL",
    );
  }
  return candidate;
}

/**
 * Request-time model normalization (POST chat only): PERMISSIVE under "auto". A concrete
 * catalog slug is accepted and later narrows the auto lane order via lanesForModel();
 * it is never written to config. For explicit backends this is identical to the strict
 * validator.
 */
export function normalizeRequestModel(
  backend: PromptBuilderBackend,
  raw: unknown,
): string {
  const candidate = typeof raw === "string" && raw.trim() ? raw.trim() : "";
  if (backend === "auto" && candidate && candidate !== "auto") {
    if (!lanesForModel(candidate).length) {
      throw promptBuilderError(
        `model ${candidate} is not in any Prompt Builder catalog`,
        "PROMPT_BUILDER_BAD_MODEL",
      );
    }
    return candidate;
  }
  return normalizePromptBuilderModel(backend, candidate || undefined);
}

/** Lanes whose catalog contains `model`, in auto order (empty for unknown slugs). */
export function lanesForModel(model: string): ResolvedPromptBuilderBackend[] {
  return PROMPT_BUILDER_AUTO_ORDER.filter((lane) => PROMPT_BUILDER_MODELS[lane].includes(model));
}

export function normalizePromptBuilderConfig(
  raw: unknown,
  current: PromptBuilderConfig,
): PromptBuilderConfig {
  const body = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const backend = normalizePromptBuilderBackend(body.backend, current.backend);
  const modelInput = body.model === undefined && backend !== current.backend
    ? DEFAULT_PROMPT_BUILDER_MODELS[backend]
    : body.model ?? current.model;
  return { backend, model: normalizePromptBuilderModel(backend, modelInput) };
}
```

`normalizePromptBuilderModel` uses `DEFAULT_PROMPT_BUILDER_MODELS[backend]` for missing
input and throws `PROMPT_BUILDER_BAD_MODEL` with
`model for <backend> must be one of: ...` for cross-backend values. Config normalization
uses the current model only when the backend is unchanged; a backend change with no model
selects the new backend default. Existing message/attachment normalization remains byte
for byte (`lib/promptBuilder/requestSchema.ts:22-56`).

#### NEW `lib/promptBuilder/router.ts`

This file owns selection and endpoint dispatch. The complete new file is:

```ts
import { getGrokEndpoint } from "../grokImageCore.js";
import { waitForOAuthReady } from "../oauthProxy/runtime.js";
import type { RuntimeContext } from "../runtimeContext.js";
import {
  PROMPT_BUILDER_AUTO_ORDER,
  type PromptBuilderBackend,
  type ResolvedPromptBuilderBackend,
} from "./constants.js";
import { promptBuilderError } from "./errors.js";
import type { PromptBuilderLaneSummary } from "./types.js";

export type PromptBuilderSelection = {
  requestedBackend: PromptBuilderBackend;
  backend: ResolvedPromptBuilderBackend;
  fallbackFrom?: ResolvedPromptBuilderBackend;
  fallbackReason?: string;
};

function unavailableBackendError(backend: ResolvedPromptBuilderBackend): Error {
  if (backend === "api") {
    return promptBuilderError(
      "OpenAI API key is required for Prompt Builder",
      "PROMPT_BUILDER_API_KEY_REQUIRED",
      401,
    );
  }
  if (backend === "grok-api") {
    return promptBuilderError(
      "xAI API key is required for Prompt Builder",
      "PROMPT_BUILDER_XAI_KEY_REQUIRED",
      401,
    );
  }
  return promptBuilderError(
    `${backend === "oauth" ? "OAuth" : "Grok"} backend is unavailable for Prompt Builder`,
    backend === "oauth"
      ? "PROMPT_BUILDER_OAUTH_UNAVAILABLE"
      : "PROMPT_BUILDER_GROK_UNAVAILABLE",
    503,
  );
}

export function selectPromptBuilderBackend(
  requestedBackend: PromptBuilderBackend,
  lanes: PromptBuilderLaneSummary,
  allowed: readonly ResolvedPromptBuilderBackend[] = PROMPT_BUILDER_AUTO_ORDER,
): PromptBuilderSelection {
  if (requestedBackend !== "auto") {
    if (lanes[requestedBackend]?.status !== "ready") {
      throw unavailableBackendError(requestedBackend);
    }
    return { requestedBackend, backend: requestedBackend };
  }
  const backend = allowed.find(
    (candidate) => lanes[candidate]?.status === "ready",
  );
  if (!backend) {
    throw promptBuilderError(
      "No Prompt Builder backend is ready",
      "PROMPT_BUILDER_NO_BACKEND_READY",
      503,
    );
  }
  const first = allowed[0];
  return backend === first
    ? { requestedBackend, backend }
    : {
        requestedBackend,
        backend,
        fallbackFrom: first,
        fallbackReason: lanes[first]?.reason || lanes[first]?.status || "not-ready",
      };
}

export async function resolvePromptBuilderTransport(
  ctx: RuntimeContext,
  backend: ResolvedPromptBuilderBackend,
  endpoint: "chat" | "responses",
): Promise<{ url: string; headers: Record<string, string>; useOAuthFetch: boolean }> {
  try {
    if (backend === "oauth") {
      await waitForOAuthReady(ctx);
      return {
        url: `${ctx.oauthUrl}${endpoint === "responses" ? "/v1/responses" : "/v1/chat/completions"}`,
        headers: { "Content-Type": "application/json" },
        useOAuthFetch: true,
      };
    }
    if (backend === "api") {
      if (!ctx.apiKey) throw unavailableBackendError("api");
      return {
        url: "https://api.openai.com/v1/responses",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          Authorization: `Bearer ${ctx.apiKey}`,
        },
        useOAuthFetch: false,
      };
    }
    const directApiKey = backend === "grok-api" ? ctx.xaiApiKey : undefined;
    if (backend === "grok-api" && !directApiKey) throw unavailableBackendError("grok-api");
    const target = getGrokEndpoint(ctx, "/v1/chat/completions", directApiKey);
    return { ...target, useOAuthFetch: false };
  } catch (error) {
    throw error;
  }
}
```

Selection applies the table in section 2.2. The second credential check in transport is
intentional defense against readiness-cache drift between selection and submission.

#### MODIFY `lib/promptBuilder/transport.ts`

Change `buildTransportPayload` to accept resolved backend first. Endpoint choice becomes:

```diff
 export function buildTransportPayload(
+  backend: ResolvedPromptBuilderBackend,
   model: string,
@@
-  const useResponses = hasImageAttachments(messages);
+  const useResponses = backend === "api"
+    || (backend === "oauth" && hasImageAttachments(messages));
@@
-        reasoning_effort: "low",
+        ...(backend === "oauth" ? { reasoning_effort: "low" } : {}),
```

Thus API always uses Responses, OAuth preserves its current text-chat/image-Responses
split, and both Grok lanes always use chat completions. The existing image `image_url`
content is retained for Grok (`lib/promptBuilder/transport.ts:12-28`).

#### MODIFY `lib/promptBuilder/client.ts`

Change the signature to accept the lane summary:

```ts
export async function requestPromptBuilderChat(
  ctxRaw: RouteRuntimeContext,
  input: PromptBuilderRequest,
  lanes: PromptBuilderLaneSummary,
): Promise<PromptBuilderChatResult>
```

The orchestration order is executable and fixed:

```ts
const ctx = requireRuntimeContext(ctxRaw);
// Per-request override (CLI --backend) wins over persisted config; both go through
// the same enum normalizer, so an unknown value is PROMPT_BUILDER_BAD_BACKEND.
// The persisted backend is the fallback, so an empty/blank override ("" is "omitted"
// to the normalizer) keeps the persisted lane instead of silently becoming auto.
const persistedBackend = normalizePromptBuilderBackend(ctx.config.promptBuilder.backend);
const requestedBackend = normalizePromptBuilderBackend(input.backend, persistedBackend);
// A backend override that differs from the persisted backend must not reuse the
// persisted model (a GPT slug or "auto" is invalid for grok, and vice versa); with no
// model override it takes the override backend's default.
const backendOverridden = requestedBackend !== persistedBackend;
const requestedModel = normalizeRequestModel(
  requestedBackend,
  input.model ?? (backendOverridden ? DEFAULT_PROMPT_BUILDER_MODELS[requestedBackend] : ctx.config.promptBuilder.model),
);
// Under auto with an explicit slug (e.g. CLI --model gpt-5.5), only lanes whose
// catalog contains that slug may be chosen (§2 explicit-model rule).
const allowedLanes = requestedBackend === "auto" && requestedModel !== "auto"
  ? lanesForModel(requestedModel)
  : PROMPT_BUILDER_AUTO_ORDER;
const selection = selectPromptBuilderBackend(requestedBackend, lanes, allowedLanes);
const model = requestedBackend === "auto"
  ? (requestedModel === "auto" ? DEFAULT_PROMPT_BUILDER_MODELS[selection.backend] : requestedModel)
  : requestedModel;
const messages = normalizeMessages(input.messages);
if (selection.fallbackFrom) {
  logEvent("prompt-builder", "backend_fallback", {
    requestedBackend,
    from: selection.fallbackFrom,
    to: selection.backend,
    reason: selection.fallbackReason,
  });
}
const payload = buildTransportPayload(selection.backend, model, messages, input.context);
const target = await resolvePromptBuilderTransport(ctx, selection.backend, payload.endpoint);
```

Use `fetchOAuth(..., { scope: "prompt-builder" })` only when
`target.useOAuthFetch`; use native `fetch` otherwise. Preserve timeout, redacted upstream
diagnostics, response parsing, and empty-response handling from
`lib/promptBuilder/client.ts:30-107,117-129`. Return both `provider` and `backend` as
`selection.backend`, plus `requestedBackend`. Split send/parse helpers so no async
function exceeds 50 lines.

#### MODIFY `routes/promptBuilder.ts`

Add GET/PUT before POST, import `buildLaneSummary`, the catalog, config normalizer, and
`updateConfigFileAtomic`.

The new route bodies are:

```ts
const configLocks = () => ({
  backend: process.env.IMA2_PROMPT_BUILDER_BACKEND !== undefined,
  model: process.env.IMA2_PROMPT_BUILDER_MODEL !== undefined,
});

const configPayload = () => ({
  ...ctx.config.promptBuilder,
  options: {
    backends: [...PROMPT_BUILDER_BACKENDS],
    models: PROMPT_BUILDER_MODELS,
    autoOrder: [...PROMPT_BUILDER_AUTO_ORDER],
  },
  locked: configLocks(),
});

app.get("/api/prompt-builder/config", (_req: Request, res: Response) => {
  res.json(configPayload());
});

app.put("/api/prompt-builder/config", async (req: Request, res: Response) => {
  try {
    const current = ctx.config.promptBuilder;
    const next = normalizePromptBuilderConfig(req.body, current);
    const locked = configLocks();
    if ((locked.backend && next.backend !== current.backend)
      || (locked.model && next.model !== current.model)) {
      throw promptBuilderError(
        "Prompt Builder config is managed by environment variables",
        "PROMPT_BUILDER_CONFIG_ENV_LOCKED",
        409,
      );
    }
    await updateConfigFileAtomic(ctx.config.storage.configFile, (existing) => {
      const saved = existing.promptBuilder;
      const base = saved && typeof saved === "object" && !Array.isArray(saved)
        ? saved as Record<string, unknown>
        : {};
      existing.promptBuilder = { ...base, ...next };
    });
    ctx.config.promptBuilder.backend = next.backend;
    ctx.config.promptBuilder.model = next.model;
    res.json(configPayload());
  } catch (error) {
    sendPromptBuilderError(res, error);
  }
});
```

Extract the current catch body (`routes/promptBuilder.ts:19-33`) into
`sendPromptBuilderError(res, error)` and use it from PUT and POST. The helper adds one
mapping on top of the current generic conversion: `code === "CONFIG_UNREADABLE"` ->
status 500, code `PROMPT_BUILDER_CONFIG_UNREADABLE`, message unchanged. The UI's
`updateConfig` catch maps that code to `t("promptBuilder.configUnreadable")` for the
Settings inline error (consumer of the i18n key in 4.3); every other code keeps the
existing `promptBuilder.failed` copy. PUT validates the pair,
rejects changed locked fields with 409, atomically merges only the nested `promptBuilder`
object, hot-updates both runtime fields, and returns the same payload.

POST first obtains `await buildLaneSummary(ctx)`, then calls
`requestPromptBuilderChat(ctx, req.body, lanes)`. This makes router tests inject a small
lane map while production consumes the existing readiness SoT.

### 4.2 UI files

#### MODIFY `ui/src/lib/api-generation.ts`; MODIFY `ui/src/lib/api.ts`

Add `PromptBuilderBackend`, `PromptBuilderConfigResponse`, `getPromptBuilderConfig`, and
`putPromptBuilderConfig`. Chat response adds `backend` and `requestedBackend`. Re-export
all four from `ui/src/lib/api.ts` beside the existing Prompt Builder exports at
`ui/src/lib/api.ts:11-14`.

```ts
export type PromptBuilderBackend = "auto" | "oauth" | "grok" | "api" | "grok-api";
export type PromptBuilderConfigResponse = {
  backend: PromptBuilderBackend;
  model: string;
  options: {
    backends: PromptBuilderBackend[];
    models: Record<PromptBuilderBackend, string[]>;
    autoOrder: Exclude<PromptBuilderBackend, "auto">[];
  };
  locked: { backend: boolean; model: boolean };
};
```

#### MODIFY `ui/src/store/promptBuilderStore.ts`

Remove the GPT union at `ui/src/store/promptBuilderStore.ts:19` and the hard-coded Luna
default at line 79. Add backend config state/actions:

```ts
backend: PromptBuilderBackend;
model: string;
modelOptions: string[];
backendOptions: PromptBuilderBackend[];
locked: { backend: boolean; model: boolean };
configLoaded: boolean;
configLoading: boolean;
lastBackend: Exclude<PromptBuilderBackend, "auto"> | null;
loadConfig: () => Promise<void>;
updateConfig: (backend: PromptBuilderBackend, model?: string) => Promise<void>;
```

Initial values are `auto`, `auto`, `["auto"]`, all five backends, unlocked, false,
false, and null. `loadConfig` is idempotent while loaded/loading. `updateConfig` picks
the first catalog model when backend changes, awaits PUT, and rolls back on failure.
`sendMessage` remains the only chat caller and sets `lastBackend: result.backend` only
on success. Hydration guard: `sendMessage` refuses (`error = t("promptBuilder.configLoading")`)
and `PromptBuilderComposer` disables its send button while `configLoaded === false`,
so the store's placeholder `auto`/`auto` pair is never transmitted against an explicit
persisted backend. Activation: mock a 3 s GET delay, persist `backend: "grok"`, reload,
submit immediately -> button disabled, no POST fired; after hydration the POST carries
`grok-4.3`. Preserve the existing message/attachment flow at
`ui/src/store/promptBuilderStore.ts:107-160`.

#### MODIFY `ui/src/components/prompt-builder/PromptBuilderModelMenu.tsx`

Delete local `MODELS`/`MODEL_ITEMS`. Read `model`, `modelOptions`, `backend`, and
`updateConfig` from the store. Keep the shared portaled `Select`, with
`modelOptions.map(value => ({ value, label: value === "auto" ?
t("promptBuilder.modelAuto") : value }))`, and call
`void updateConfig(backend, value)`.

#### MODIFY `ui/src/components/prompt-builder/PromptBuilderPanel.tsx`

Load config on mount. Add the success-only badge next to the scope badge:

```diff
+  const lastBackend = usePromptBuilderStore((s) => s.lastBackend);
+  const loadConfig = usePromptBuilderStore((s) => s.loadConfig);
+  useEffect(() => { void loadConfig(); }, [loadConfig]);
@@
           <span className="section-title">{t("promptBuilder.title")}</span>
           <PromptBuilderScopeBadge />
+          {lastBackend ? (
+            <span className="prompt-builder__backend-badge">
+              {t("promptBuilder.viaBackend", {
+                backend: t(`promptBuilder.backends.${lastBackend === "grok-api" ? "grokApi" : lastBackend}`),
+              })}
+            </span>
+          ) : null}
```

#### MODIFY `ui/src/components/prompt-builder/PromptBuilderMessageList.tsx`

Read `error` and append `<div className="prompt-builder__error" role="alert">{error}</div>`
after loading. This is how explicit missing-key errors remain visible rather than silently
falling back or disappearing in store state.

#### NEW `ui/src/components/settings/PromptBuilderSettings.tsx`

Render two standard `.settings-row` articles: backend and model. Reuse the Prompt Builder
store, call `loadConfig` on mount, disable each select from its `locked` bit, and show
`settings.promptBuilder.envLocked` when either field is locked. Backend labels come from
`promptBuilder.backends.*`; model `auto` uses `promptBuilder.modelAuto`. No local fetch or
second config state is allowed. The complete new component is:

```tsx
import { useEffect } from "react";
import { useI18n } from "../../i18n";
import {
  usePromptBuilderStore,
  type PromptBuilderBackend,
} from "../../store/promptBuilderStore";
import { Select } from "../controls";

function backendLabelKey(backend: PromptBuilderBackend): string {
  return `promptBuilder.backends.${backend === "grok-api" ? "grokApi" : backend}`;
}

export function PromptBuilderSettings() {
  const { t } = useI18n();
  const backend = usePromptBuilderStore((state) => state.backend);
  const model = usePromptBuilderStore((state) => state.model);
  const backendOptions = usePromptBuilderStore((state) => state.backendOptions);
  const modelOptions = usePromptBuilderStore((state) => state.modelOptions);
  const locked = usePromptBuilderStore((state) => state.locked);
  const loadConfig = usePromptBuilderStore((state) => state.loadConfig);
  const updateConfig = usePromptBuilderStore((state) => state.updateConfig);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  return (
    <>
      <article className="settings-row">
        <div className="settings-row__copy">
          <h4>{t("settings.promptBuilder.title")}</h4>
          <p>{t("settings.promptBuilder.body")}</p>
          {locked.backend || locked.model ? (
            <p className="settings-row__microcopy">
              {t("settings.promptBuilder.envLocked")}
            </p>
          ) : null}
        </div>
        <div className="settings-row__control">
          <Select<PromptBuilderBackend>
            value={backend}
            items={backendOptions.map((value) => ({
              value,
              label: t(backendLabelKey(value)),
            }))}
            onChange={(value) => void updateConfig(value)}
            ariaLabel={t("settings.promptBuilder.backendLabel")}
            disabled={locked.backend || locked.model}
          />
        </div>
      </article>
      <article className="settings-row">
        <div className="settings-row__copy">
          <h4>{t("settings.promptBuilder.modelLabel")}</h4>
          <p>{t("settings.promptBuilder.modelBody")}</p>
        </div>
        <div className="settings-row__control">
          <Select<string>
            value={model}
            items={modelOptions.map((value) => ({
              value,
              label: value === "auto" ? t("promptBuilder.modelAuto") : value,
            }))}
            onChange={(value) => void updateConfig(backend, value)}
            ariaLabel={t("settings.promptBuilder.modelLabel")}
            disabled={locked.model}
          />
        </div>
      </article>
    </>
  );
}
```

The backend control also disables when the model is env-locked: changing backend normally
resets model atomically, which must not appear editable when that paired field cannot move.

#### MODIFY `ui/src/components/SettingsWorkspace.tsx`

Import `PromptBuilderSettings` and mount it in the existing Providers section immediately
after the image-model row at `ui/src/components/SettingsWorkspace.tsx:205-216`. Do not add
a fourth Settings navigation section; the baseline design keeps provider choices in
Providers (`ui/src/components/SettingsWorkspace.tsx:20-24,189-256`).

#### MODIFY `ui/src/styles/prompt-builder.css`

Add solid-token styles only:

```css
.prompt-builder__backend-badge {
  display: inline-flex;
  margin: 7px 0 0 5px;
  padding: 3px 7px;
  border: 1px solid var(--border);
  border-radius: var(--r-pill);
  background: var(--surface-2);
  color: var(--text-dim);
  font-size: 10px;
  line-height: 1.2;
}
.prompt-builder__error {
  padding: 9px 10px;
  border: 1px solid color-mix(in srgb, var(--red) 55%, var(--border));
  border-radius: var(--r-xl);
  color: var(--red);
  font-size: 12px;
  line-height: 1.4;
}
```

#### MODIFY `bin/commands/prompt-sub/build.ts`

Replace the stale GPT-only `--model` help at `bin/commands/prompt-sub/build.ts:16` with:

```diff
-    --model <model>           Builder model (gpt-5.5, gpt-5.4, gpt-5.4-mini, gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna)
+    --model <model>           Model for the configured Prompt Builder backend
```

A per-request `--backend <auto|oauth|api|grok|grok-api>` flag is added to
`bin/commands/prompt-sub/build.ts` (`FLAGS.backend: { type: "string" }`, forwarded as
`backend` in the POST body; the request schema accepts an optional `backend` override
validated with the same catalog). Omitted `--model` follows persisted config; an
explicit model is validated against the effective backend, and under `auto` the
explicit-model rule in §2 resolves the lane from the slug so the documented
`--model gpt-5.5` example keeps working.

### 4.3 i18n diff

Add these keys to both namespaces. English and Korean are final copy:

| Key | en | ko |
|---|---|---|
| `promptBuilder.viaBackend` | `via {backend}` | `{backend} 경유` |
| `promptBuilder.modelAuto` | `Backend default` | `백엔드 기본값` |
| `promptBuilder.backends.auto` | `Auto` | `자동` |
| `promptBuilder.backends.oauth` | `GPT OAuth` | `GPT OAuth` |
| `promptBuilder.backends.api` | `OpenAI API` | `OpenAI API` |
| `promptBuilder.backends.grok` | `Grok` | `Grok` |
| `promptBuilder.backends.grokApi` | `Grok API` | `Grok API` |
| `settings.promptBuilder.title` | `Prompt Builder backend` | `프롬프트 빌더 백엔드` |
| `settings.promptBuilder.body` | `Choose the text backend that refines prompts. Auto tries OAuth, Grok, OpenAI API, then Grok API, and every successful reply shows the backend used.` | `프롬프트를 다듬을 텍스트 백엔드를 고릅니다. 자동은 OAuth, Grok, OpenAI API, Grok API 순으로 시도하며, 성공한 응답에는 실제 사용한 백엔드가 표시됩니다.` |
| `settings.promptBuilder.backendLabel` | `Builder backend` | `빌더 백엔드` |
| `settings.promptBuilder.modelLabel` | `Builder model` | `빌더 모델` |
| `settings.promptBuilder.modelBody` | `Only models supported by the selected backend are shown.` | `선택한 백엔드가 지원하는 모델만 표시됩니다.` |
| `settings.promptBuilder.envLocked` | `Managed by environment variables.` | `환경 변수로 관리됩니다.` |
| `promptBuilder.configLoading` | `Loading builder settings...` | `빌더 설정을 불러오는 중...` |
| `promptBuilder.configUnreadable` | `Could not save: ~/.ima2/config.json is unreadable. Fix or move the file, then retry.` | `저장 실패: ~/.ima2/config.json을 읽을 수 없습니다. 파일을 고치거나 옮긴 뒤 다시 시도하세요.` |

Files to MODIFY are `ui/src/i18n/en.json`, `ui/src/i18n/ko.json`,
`ui/src/i18n/zh-Hans.json`, and `ui/src/i18n/zh-Hant.json`. The two Chinese files must
receive translated values for every key above; copying English is not acceptable.

Locale scope is settled at the four runtime locales (`ui/src/i18n/index.ts:1-9,62-77`);
a Japanese locale is a non-goal of this unit (000_plan.md "Locale correction").

### 4.4 Test files

#### MODIFY `tests/prompt-builder-contract.test.ts`

Replace GPT-global model assertions with these executable contract cases:

- Router: explicit `grok` + ready selects Grok; explicit `api` + `key-missing` throws
  status 401/code `PROMPT_BUILDER_API_KEY_REQUIRED`; auto with OAuth disconnected and
  Grok ready selects Grok with `fallbackFrom: "oauth"`; auto with no ready lane throws
  `PROMPT_BUILDER_NO_BACKEND_READY`.
- Schema (persisted, `normalizePromptBuilderModel` / `normalizePromptBuilderConfig`): each
  backend accepts every catalog model; OAuth/API reject `grok-4.3`; Grok/Grok API reject
  `gpt-5.6-luna`; auto accepts only `auto` (PUT `{backend:"auto", model:"gpt-5.5"}` ->
  400 `PROMPT_BUILDER_BAD_MODEL`, file untouched); backend changes without model reset
  to the new default.
- Schema (request, `normalizeRequestModel`): auto + `gpt-5.5` returns `gpt-5.5` and
  `lanesForModel` yields `["oauth","api"]`; auto + `grok-4.3` yields
  `["grok","grok-api"]`; auto + unknown slug throws `PROMPT_BUILDER_BAD_MODEL`; the
  config file is never written by POST.
- Client backend-only override: persisted `{backend:"auto",model:"auto"}` +
  request `{backend:"grok"}` (no model) resolves `grok-4.3`; persisted
  `{backend:"oauth",model:"gpt-5.6-luna"}` + request `{backend:"grok"}` resolves
  `grok-4.3`, not `gpt-5.6-luna`; request `{backend:"grok", model:"gpt-5.5"}` throws
  `PROMPT_BUILDER_BAD_MODEL`.
- Client boundary: persisted `{backend:"grok"}` + request `{backend:""}` (and
  `{backend:"  "}`) keeps `grok`, not auto; request `{backend:"bogus"}` throws
  `PROMPT_BUILDER_BAD_BACKEND`.
- Route: GET returns current pair/catalog/lock bits; PUT writes both fields to a temporary
  `config.json` and hot-updates the injected runtime context; invalid Grok+GPT pair returns
  400 `PROMPT_BUILDER_BAD_MODEL`; env-locked change returns 409 and leaves file/runtime
  unchanged; POST passes `buildLaneSummary` output to the client.
- Transport: OAuth text -> chat, OAuth image -> Responses, API text/image -> Responses,
  Grok/Grok API text/image -> chat; Grok payload omits `reasoning_effort`.
- Result: successful response includes `provider`, `backend`, and `requestedBackend`.

Use a temporary directory and ephemeral Express listener following the existing route-test
shape at `tests/minimax-key-validation-route.test.ts:33-64`; restore environment variables
and remove the temp directory in `finally`.

#### MODIFY `tests/prompt-studio-ui-contract.test.js`

Replace the “Luna-first menu” assertions at
`tests/prompt-studio-ui-contract.test.js:47-57` with assertions that the model menu reads
`modelOptions`, calls `updateConfig(backend, model)`, stays a portaled shared `Select`, and
contains no local model array. Add assertions for `PromptBuilderSettings`, the
`lastBackend` badge, and the error alert.

#### MODIFY `tests/gpt56-rollout-contract.test.ts`

At `tests/gpt56-rollout-contract.test.ts:78-86`, keep GPT 5.6 catalog assertions against
`lib/promptBuilder/constants.ts`, but stop requiring model literals in the menu; assert
that the menu consumes server-projected `modelOptions` instead.

#### MODIFY `tests/model-default-projection-contract.test.ts`

At `tests/model-default-projection-contract.test.ts:64-78`, replace the requirement that
the menu source itself contain a current model slug with a requirement that `config.ts`,
`lib/promptBuilder/constants.ts`, and `ui/src/store/promptBuilderStore.ts` project the
catalog/default. The menu is now data-driven by GET config.

#### `tests/i18n-coverage-contract.test.ts` — NO CHANGE

Current parity already protects all four dictionaries
(`tests/i18n-coverage-contract.test.ts:53-65`); the four-file Builder key addition needs
no test edit.

No new test filename is created, so `docs/migration/runtime-test-inventory.md` remains
unchanged and `npm run test:inventory` should stay clean.

## 5. C-ACTIVATION-GROUNDING-01

| Conditional path | Setup | Action | Required observation |
|---|---|---|---|
| explicit Grok, ready | config `{backend:"grok",model:"grok-4.3"}`; lane summary `grok.ready` | POST one text message | one `/v1/chat/completions` call through progrok; response `backend=grok`; UI badge `via Grok`; no fallback log |
| explicit API, key missing | config `{backend:"api",model:"gpt-5.6-luna"}`; lane `api.key-missing` | POST one text message | HTTP 401 `{error:{code:"PROMPT_BUILDER_API_KEY_REQUIRED"}}`; no OAuth/Grok request; visible alert; existing badge unchanged |
| auto, OAuth down, Grok ready | config `{backend:"auto",model:"auto"}`; OAuth disconnected; Grok ready | POST one text message | Grok selected; exactly one `prompt-builder.backend_fallback` log from OAuth to Grok; response `requestedBackend=auto,backend=grok`; badge `via Grok` |
| auto, OAuth and Grok down, OpenAI key ready | lane summary OAuth/Grok disconnected, API ready | POST | direct OpenAI Responses call, fallback log `to=api`, badge `via OpenAI API` |
| auto, no lane ready | all four non-ready | POST | 503 `PROMPT_BUILDER_NO_BACKEND_READY`; zero upstream calls |
| explicit Grok API, key missing | `grok-api.key-missing` | POST | 401 `PROMPT_BUILDER_XAI_KEY_REQUIRED`; no progrok fallback |
| backend switch | start OAuth/Luna, PUT `{backend:"grok"}` without model | GET config | persisted/runtime pair becomes Grok/`grok-4.3`; both Settings and panel menus show Grok models only |
| cross-backend model | PUT or POST Grok + `gpt-5.6-luna` | request | 400 `PROMPT_BUILDER_BAD_MODEL`; config unchanged |
| env override | launch with backend/model env vars | open Settings and attempt PUT | controls disabled; env copy visible; forced PUT returns 409; file values do not replace runtime env values |
| OAuth image attachment | explicit OAuth, image attached | POST | Responses endpoint and existing SSE parser path |
| Grok image attachment | explicit Grok, image attached | POST | chat completions with `image_url` content; no Responses call |

## 6. Render grounding

Use a fresh server, never the stale process on the default port:

```bash
IMA2_PORT=<spare-port> node bin/ima2.js serve
```

At a 1280x720 viewport capture:

1. Settings -> Providers, scrolled so both “Prompt Builder backend” and “Builder model”
   rows are fully visible. Select Grok and confirm the model menu contains only
   `grok-4.3`, `grok-4.6`, and `grok-4.5`.
2. Prompt Studio -> right sidebar -> Prompt Builder, after one successful explicit Grok
   message. Capture the header, model picker, response, and `via Grok` badge in one frame.
3. Deterministic fallback screenshot: with the spare server's isolated test configuration,
   make OAuth non-ready while progrok is ready, select Auto, send one message, and capture
   `via Grok`. Also retain the corresponding server log line as non-visual evidence.
4. Negative screenshot: select OpenAI API in an isolated config with no OpenAI key, send
   once, and capture the visible typed-error alert; verify no success badge change.

Do not use the existing default-port service or terminate the desktop app. Save evidence
under the parent cycle's evidence location chosen during implementation; this docs-only
cycle creates no screenshot artifact.

## 7. Verifier reality and commands

| Command | Reads this docs-only change target? | What it proves after implementation |
|---|---|---|
| `node scripts/check-devlog-citations.mjs devlog/_plan/260902_studio_surfaces` | yes | repo-relative citation syntax for this plan |
| `npm run typecheck` | no; Markdown is outside tsconfig | planned `config.ts`, `lib/**`, and `routes/**` types compile |
| `npm run typecheck:tests` | no for this cycle | modified Prompt Builder test types compile |
| `npm test` | no for this cycle | router, route, schema, transport, and UI source contracts pass |
| `npm run test:inventory` | no; it classifies test files, and this plan adds none | existing test filename remains classified; generated inventory is not stale |
| `cd ui && npm run build` | no; Vite does not read devlog | Settings/store/panel/i18n UI compiles and bundles |

Implementation completion requires all five user-mandated repository commands, not only
the focused tests. This docs-only unit may claim only that the design file and citation
check are complete.

## 8. Open questions / escalation record

1. Locale scope: RESOLVED at four locales (see 000_plan.md); no parent decision pending.
2. The chosen auto order prefers signed-in local lanes over API keys. If product policy
   instead wants OpenAI API before progrok, change only `PROMPT_BUILDER_AUTO_ORDER` and the
   explanatory copy/tests before implementation; do not make order depend on incidental
   object-key order.
3. Gemini remains excluded until a reusable text adapter exists. The image
   `generateContent` body is not evidence of a compatible multi-turn text contract.
