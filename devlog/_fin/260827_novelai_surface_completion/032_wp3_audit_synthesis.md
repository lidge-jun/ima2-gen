# 032 — wp3 audit synthesis

Reviewer verdict: FAIL. Six findings accepted.

## H1 — helper API names contradicted

030 now uses the exact pure result names defined by 031: `parseNaiCliOptions` and
`finalizeNaiCliTarget`.

## H2 — target combinations were prose-only

031 now has a complete provider/model table, including `auto`, absent values,
namespaced NAI, explicit non-NAI, and both conflict directions.

## H3 — pre-network insertion point was ambiguous

031 names exact per-command positions. Node preflight precedes ref extraction and
`fileToDataUri`, not merely `getServer`.

## H4 — JSON/text behavior was underspecified

New NAI preflight/finalize failures use `fail({json})`, tested in both modes with exit
2 and an unreachable server. Existing downstream stream/provider error formatting is
not widened in this phase.

## M1 — inventory update was falsely conditional

030/031 now require classifier regeneration and a green inventory check.

## M2 — body mapping was implicit

031 now maps every flag to its exact `NaiRequestOptions` camelCase key and type rule;
the shared payload is typed to that server contract.
