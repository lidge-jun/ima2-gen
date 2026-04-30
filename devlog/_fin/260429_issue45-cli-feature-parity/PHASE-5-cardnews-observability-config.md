# Phase 5 — Card News, Observability, Config

## Goal

Wrap up the remaining endpoint domains: Card News, observability surfaces in `routes/health.ts`, and a `config get/set` to replace hand-editing `~/.ima2/config.json`. Lowest priority phase. May spin off as a follow-up if the rest of #45 ships first.

## Verified endpoints

### Card News (`routes/cardNews.ts`, gated at `routes/index.ts:30`)

```js
// routes/index.ts:30
if (ctx.config.features.cardNews) registerCardNewsRoutes(app, ctx);
```

Gate value source (`config.js:161-162`):

```js
features: {
  cardNews: pickBool(env.IMA2_CARD_NEWS, fileCfg.features?.cardNews, env.IMA2_DEV === "1"),
},
```

CLI must check `runtimeConfig.features.cardNews` (NOT the previously-claimed `runtimeConfig.cardNewsEnabled`). When disabled, Card News commands hit 404 — the CLI should pre-check and message clearly.

| Endpoint | Line | Notes |
|---|---:|---|
| `GET /api/cardnews/image-templates` | 61 | list image templates |
| `GET /api/cardnews/image-templates/:templateId/preview` | 69 | preview a template |
| `GET /api/cardnews/role-templates` | 78 | list role templates |
| `GET /api/cardnews/sets` | 82 | list sets |
| `GET /api/cardnews/sets/:setId` | 90 | show set |
| `GET /api/cardnews/sets/:setId/manifest` | 98 | set manifest |
| `POST /api/cardnews/draft` | 110 | create draft |
| `POST /api/cardnews/generate` | 118 | run generation |
| `POST /api/cardnews/jobs` | 127 | create job |
| `GET /api/cardnews/jobs/:jobId` | 137 | show job (no list endpoint) |
| `POST /api/cardnews/jobs/:jobId/retry` | 146 | retry |
| `POST /api/cardnews/cards/:cardId/regenerate` | 163 | regen single card |
| `POST /api/cardnews/export` | 176 | export bundle |

**Phantom removed**: `GET /api/cardnews/jobs` (no listing endpoint). CLI exposes `cardnews job show <id>` only.

### Observability (all in `routes/health.ts`)

| Endpoint | Line | Notes |
|---|---:|---|
| `GET /api/providers` | 18 | configured providers |
| `GET /api/health` | 30 | health summary (already used by `ping`) |
| `GET /api/oauth/status` | 43 | OAuth proxy state |
| `GET /api/inflight` | 65 | full inflight job list (richer than current `ps`) |
| `DELETE /api/inflight/:requestId` | 84 | force-remove a stuck job |
| `GET /api/billing` | 89 | usage/quota |

### Storage (`routes/storage.ts`)

| Endpoint | Line | Method correction |
|---|---:|---|
| `GET /api/storage/status` | 5 | unchanged |
| `POST /api/storage/open-generated-dir` | 13 | **POST**, not GET as earlier draft claimed |

## New file: `bin/commands/cardnews.ts`

Pre-flight gate check at top of every subcommand:

```ts
import { config as runtimeConfig } from "../../config.js";

function ensureCardNewsEnabled() {
  if (!runtimeConfig.features?.cardNews) {
    die(2, "Card News feature is disabled. Set IMA2_CARD_NEWS=1 (or features.cardNews in config.json) and restart the server.");
  }
}
```

| CLI | Endpoint | Body |
|---|---|---|
| `cardnews templates` | `GET /api/cardnews/image-templates` + `GET /api/cardnews/role-templates` (combined) | — |
| `cardnews template preview <id>` | `GET /api/cardnews/image-templates/:templateId/preview` | — |
| `cardnews sets` | `GET /api/cardnews/sets` | — |
| `cardnews set show <id>` | `GET /api/cardnews/sets/:setId` | — |
| `cardnews set manifest <id>` | `GET /api/cardnews/sets/:setId/manifest` | — |
| `cardnews draft <args>` | `POST /api/cardnews/draft` | server-defined |
| `cardnews generate <args>` | `POST /api/cardnews/generate` | server-defined |
| `cardnews job create <args>` | `POST /api/cardnews/jobs` | server-defined |
| `cardnews job show <id>` | `GET /api/cardnews/jobs/:jobId` | — |
| `cardnews job retry <id>` | `POST /api/cardnews/jobs/:jobId/retry` | — |
| `cardnews card regenerate <id>` | `POST /api/cardnews/cards/:cardId/regenerate` | — |
| `cardnews export` | `POST /api/cardnews/export` | — |

**Decision point (start of phase)**: if `draft`/`generate`/`job create` body shapes are still wizard-style (multi-step state in UI), defer those three. Ship the rest as a thin read-only wrapper. Re-audit `routes/cardNews.ts` body parsers immediately before starting.

## New file: `bin/commands/observability.ts`

Single multiplexer; all subcommands are simple GETs.

| CLI | Endpoint | Notes |
|---|---|---|
| `storage status [--json]` | `GET /api/storage/status` | richer than current `doctor` output |
| `storage open` | `POST /api/storage/open-generated-dir` | **POST** |
| `billing [--json]` | `GET /api/billing` | usage |
| `providers [--json]` | `GET /api/providers` | |
| `oauth status [--json]` | `GET /api/oauth/status` | |
| `inflight ls [--json]` | `GET /api/inflight` | supersedes `ps` |
| `inflight rm <requestId>` | `DELETE /api/inflight/:requestId` | force-clear stuck |

`ps` (existing root command) becomes a thin alias that calls the same code path as `inflight ls` for backward compatibility.

## New file: `bin/commands/config.ts`

Two layers: file (`~/.ima2/config.json`) and effective (env > file > defaults from `config.js`).

| CLI | Action |
|---|---|
| `config path` | print `runtimeConfig.storage.configFile` |
| `config ls [--effective]` | print file contents (default) or merged effective config (`--effective`) |
| `config get <key>` | dotted-key getter on effective config; redacts sensitive keys |
| `config set <key> <value>` | writes the file layer; refuses unknown keys; warns about server restart |
| `config rm <key>` | delete the key from the file layer |

### Sensitive-key redaction

```ts
const REDACT_KEYS = new Set([
  "provider", "apiKey", "oauth.token", "oauth.refreshToken",
  // Anything matching /token/i, /secret/i, /apiKey/i, /password/i
]);

function redactValue(key: string, value: any) {
  if (REDACT_KEYS.has(key) || /token|secret|apikey|password/i.test(key)) {
    return value ? "<redacted>" : value;
  }
  return value;
}
```

`config get` and `config ls` always pass values through `redactValue`. `config set` accepts the key but warns if the key is in REDACT_KEYS:

```
warning: writing oauth.token to config file. This is a long-lived credential.
Continue? [y/N]
```

### Schema enforcement

Whitelist of known keys, mirroring `config.js` shape:

```ts
const KNOWN_KEYS = new Set([
  "imageModels.default",
  "imageModels.reasoningEffort",
  "imageModels.validReasoningEfforts", // not settable; reject
  "log.level",
  "features.cardNews",
  "cardNewsPlanner.enabled",
  "cardNewsPlanner.model",
  "cardNewsPlanner.timeoutMs",
  "cardNewsPlanner.deterministicFallback",
  "storage.generatedDir",
  "storage.generatedDirName",
  // …auth keys are read-only; setting them goes through `setup`/`login` instead
]);
```

`config set unknown.key foo` → exit 2 with "unknown config key. Run `config ls --effective` to see valid keys."

`config set` cannot override env-var-set values at runtime (env wins per `config.js:7-9` merge). The CLI shows a warning when the user sets a key that has an active env override:

```
warning: env IMA2_REASONING_EFFORT=medium is currently overriding this value.
The file change will only apply after unsetting the env var and restarting the server.
```

### Restart caveat

`config.js` loads once at module import. File changes don't take effect until the server restarts. `config set` always prints:

```
✓ wrote imageModels.reasoningEffort=none to ~/.ima2/config.json
note: server must be restarted to pick up config changes (run `ima2 reset` then `ima2 serve`)
```

## `bin/ima2.ts` router diff

```diff
   case "session":
   case "history":
   case "prompt":
   case "multimode":
   case "node":
   case "annotate":
   case "canvas-versions":
   case "metadata":
   case "comfy":
+  case "cardnews":
+  case "storage":
+  case "billing":
+  case "providers":
+  case "oauth":
+  case "inflight":
+  case "config":
   case "ping": {
```

`storage`, `billing`, `providers`, `oauth`, `inflight` map to a single `bin/commands/observability.ts` via a small dispatch:

```ts
// bin/commands/storage.ts (and friends) — each is 5 lines:
import obs from "./observability.js";
export default (argv) => obs(["storage", ...argv]);
```

Or, simpler: hardcode the router branches to map to `observability.ts` directly:

```diff
-  case "storage":
-  case "billing":
-  case "providers":
-  case "oauth":
-  case "inflight": {
+  case "storage":
+  case "billing":
+  case "providers":
+  case "oauth":
+  case "inflight": {
+    const { setCliVersion } = await import("./lib/client.js");
+    setCliVersion(pkg.version);
+    const mod = await import("./commands/observability.js");
+    await mod.default([command, ...args.slice(1)]);
+    break;
+  }
```

(Pick whichever style is cleaner during implementation. Both work.)

## Tests

```js
test("cardnews refuses when features.cardNews is false", async () => {
  // mock runtimeConfig.features.cardNews = false; exec ima2 cardnews templates
  // exit 2, message contains "IMA2_CARD_NEWS"
});

test("cardnews templates merges image-templates and role-templates", async () => {
  // intercept two GETs; assert combined output
});

test("storage open uses POST", async () => {
  // intercept; method === "POST"
});

test("inflight ls returns full job objects (richer than ps)", async () => {
  // assert response shape includes phase, model, prompt, etc.
});

test("inflight rm <id> sends DELETE", async () => {
  // intercept; method DELETE
});

test("config get oauth.token returns <redacted>", async () => {
  // seed config.json with oauth.token=secret; assert output is <redacted>
});

test("config set unknown.key exits 2", async () => {
  // exec → exit 2, stderr contains "unknown config key"
});

test("config set imageModels.reasoningEffort none writes file and warns about restart", async () => {
  // assert file contents include the new value, stdout contains "server must be restarted"
});

test("config set warns when env var overrides", async () => {
  // env IMA2_REASONING_EFFORT=medium; exec config set imageModels.reasoningEffort none
  // stdout contains "env IMA2_REASONING_EFFORT=medium is currently overriding"
});
```

## Acceptance

- `bin/commands/cardnews.ts`, `observability.ts`, `config.ts` exist; each under 500 lines.
- `cardnews` subcommands all pre-check `runtimeConfig.features.cardNews`.
- `storage open` uses POST.
- `config get` redacts any key matching `/token|secret|apikey|password/i`.
- `config set` validates against `KNOWN_KEYS` whitelist; rejects unknown.
- `config set` warns on env-var override and on server-restart requirement.
- All Phase 5 smoke tests green.
- README adds `Card News`, `Observability`, `Config` sections.
- Issue #45 closes when Phases 1–4 are merged. Phase 5 may spin off as #46-style follow-up if Card News surface is still moving.

## Watchouts

- Card News API is the youngest and most likely to drift. Re-audit `routes/cardNews.ts` immediately before starting. Don't trust this doc's body shapes past 2026-05.
- `config set` foot-guns: typos must not silently no-op. Strict whitelist. No autocomplete heuristics.
- `inflight rm` of an actively-streaming job leaves stranded server resources. If the route accepts a "graceful cancel" mode, prefer that. Otherwise document the risk in `--help`.
- Auth keys (`provider`, `apiKey`) live in the same `~/.ima2/config.json` as `imageModels.*` etc. (`bin/ima2.ts:22-45`). `config set` must refuse to write them and direct users to `setup`/`login` instead.
- `config ls --effective` must walk the same merge order `config.js` does (env > file > defaults). Read env at runtime; do not cache.

## Decision Points (start of Phase 5)

1. Are `cardnews draft`/`generate`/`job create` body shapes idempotent enough for one-shot CLI? If still wizard-driven, ship only the read-only and `retry`/`regenerate` commands.
2. Does the existing `ps` command need to stay? If yes, keep it as an alias to `inflight ls`. If no, deprecate (warn for one release, remove next).
3. Is `~/.ima2/config.json` schema large enough to need a real validation lib (`zod`)? Default answer: no — the hand-rolled `KNOWN_KEYS` set is enough for now.

## Out of Scope for Phase 5

- A TUI/dashboard for inflight jobs (`inflight ls` is one-shot only).
- Plugin system for new CLI commands.
- Card News creation wizard parity (ship only when API is no longer wizard-shaped).
- A `config edit` command that opens `$EDITOR` on the config file — deferred until requested.
