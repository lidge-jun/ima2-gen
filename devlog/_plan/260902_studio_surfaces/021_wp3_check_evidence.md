# 021 — wp3 check evidence (Prompt Builder backend)

Commits: b83ddd71 (routing), 3190215a (settings + hydration), dde0c71c (tests),
e0bd311f (shared contracts), 9159ba74 (docs/API.md, hardening-contract repoint to
`lib/configFileStore.ts`, structure line counts — three consequential edits outside
the worker's write map, made by main).

Verifiers at 9159ba74: `npm test` pass 2764 / fail 0; typecheck, typecheck:tests,
test:inventory, ui build exit 0.

## Live route probes (fresh serve on 3461 after `npm run build:server`)

| Probe | Result |
|---|---|
| GET /api/prompt-builder/config | `{backend:"auto",model:"auto",options.autoOrder:[oauth,grok,api,grok-api],locked:{false,false}}` |
| PUT `{backend:"auto",model:"gpt-5.5"}` | 400 `PROMPT_BUILDER_BAD_MODEL` "model for auto must be one of: auto"; file untouched |
| PUT `{backend:"grok"}` | 200, model reset to `grok-4.3`; `~/.ima2/config.json` promptBuilder = `{grok, grok-4.3}` |
| POST chat `{backend:"api"}` (no key) | 401 `PROMPT_BUILDER_API_KEY_REQUIRED` — explicit backend, no fallback |
| POST chat `{backend:"bogus"}` | 400 `PROMPT_BUILDER_BAD_BACKEND` |
| POST chat `{backend:"grok",model:"gpt-5.5"}` | 400 `PROMPT_BUILDER_BAD_MODEL` (cross-catalog) |
| POST chat, persisted grok | 200 `backend:"grok", requestedBackend:"grok", model:"grok-4.3"`, reply "pong" (live progrok) |
| POST chat, persisted auto + `model:"gpt-5.5"` | 200 `backend:"oauth", requestedBackend:"auto", model:"gpt-5.5"` — lane narrowed by slug (live OAuth) |

Auto fallback (oauth down -> grok) is covered by
`tests/prompt-builder-contract.test.ts` which asserts the `prompt-builder.backend_fallback`
log event with an injected lane map; it was not reproduced live because the OAuth
proxy on this host is healthy and stopping it is out of scope.

## Render grounding

| Screenshot | Observed |
|---|---|
| `evidence/020-builder-grok-badge-1280x720.png` | right sidebar Builder tab: model menu `grok-4.3`, "via Grok" badge after a live reply "pong" |
| `evidence/020-settings-builder-1280x720.png` | Settings > Providers: "Prompt Builder backend" select = Grok, "Builder model" select = grok-4.3, explanatory copy |

Config restored to `{backend:"auto",model:"auto"}` afterwards.

