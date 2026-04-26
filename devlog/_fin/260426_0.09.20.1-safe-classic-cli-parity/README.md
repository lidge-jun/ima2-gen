# 0.09.20.1 — Safe Classic CLI Parity

## Status

- Status: done
- Completed: 2026-04-26
- Scope: Classic CLI parity for generate/edit/inflight commands.

## What Changed

```text
ima2 gen/edit
├─ --model
├─ --mode auto|direct
├─ --moderation auto|low
└─ --session

ima2 ps
└─ --terminal

ima2 cancel
└─ cancel/mark an in-flight request id

CLI errors
├─ stable error-code hints
├─ SERVER_UNREACHABLE hint coverage
└─ JSON stdout remains parseable while hints go to stderr
```

## Changed Files

| File | Change |
|---|---|
| `bin/commands/gen.js` | Added model/mode/moderation/session flags and payload fields. |
| `bin/commands/edit.js` | Added model/mode/moderation/session flags and payload fields. |
| `bin/commands/ps.js` | Added `--terminal` support through `includeTerminal=1`. |
| `bin/commands/cancel.js` | Added cancel command against `DELETE /api/inflight/:requestId`. |
| `tests/cli-commands.test.js` | Added CLI parity, cancel, unreachable hint, and JSON stdout tests. |

## Verification

```text
node --test tests/cli-lib.test.js tests/cli-error-hints.test.js
→ pass 15 / fail 0

node --test tests/cli-commands.test.js
→ pass 17 / fail 0

npm test
→ pass 245 / fail 0

npm run ui:build
→ success

git diff --check
→ success
```

## Notes

- `cancel` marks the request id as canceled in the local server inflight registry. It does not guarantee that an upstream provider call was physically killed.
- `gpt-5.3-codex-spark` remains pass-through at CLI validation level so the server can return the intended `IMAGE_MODEL_UNSUPPORTED` hint.
- Remaining CLI parity work stays in `devlog/_plan/0.09.20-cli-backend-parity/README.md`, starting with storage/runtime/OAuth commands.
