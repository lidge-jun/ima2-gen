# Contributing

## Local checks

Run these in order. Stop at the first red command.

1. `npm run typecheck`
2. `npm test`
3. `cd ui && npm run build` — only when the change touches `ui/`

`npm run verify:release:source` is optional before a PR. It chains native
deps, both typechecks, inventory, UI build, server/CLI build, the full
suite, package lint, install policy, and the audit gate. CI already runs
the release-relevant subset. Do not treat the full local chain as required.

## Devlog

Implementation work belongs in a numbered unit under
`devlog/_plan/YYMMDD_slug/`. Do not add bare `PLAN.md` / `PHASES.md`
files.

## Pull requests

- Keep one logical change per PR.
- Do not publish, change dist-tags, dispatch release workflows, or merge
  from the PR itself unless that is the explicit task.
- Do not attach cookies, OAuth tokens, API keys, or generated base64.

