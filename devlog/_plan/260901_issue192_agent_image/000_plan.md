# 260901 — Issue #192: Agent Mode image generation fails as text-only

## Reported

Agent Mode reads image context, calls the image tool, and ends with
`ima2.generate_image retry: text-only result rejected` then
`Agent result did not include an image artifact.`

## What the reproduction actually showed

Two of the three suspected causes were FALSIFIED by running them, not by reading:

| Hypothesis | Result |
|---|---|
| A normal image response fails to reach the artifact | **FALSE** — repro A returned HTTP 200 with a stored image on the first upstream hit |
| The give-up error loses its cause | **FALSE on the direct route** — repro B returned `AGENT_TEXT_ONLY_RESULT` with `rawCode=EMPTY_RESPONSE` |
| The session image never reaches the model | **TRUE** — repro C: `carriesImage=false` |

## Root cause (primary)

`lib/agentImageVideoGen.ts` loads the session's current image as a reference for
atlascloud (:120), minimax (:127), and grok (:145) — but the Responses branch
(`generateViaResponses`, :149-165) passes a hardcoded `[]` as its `references`
argument. OAuth and API are the default Agent providers.

So on the default path the user says "use this image", `sourceImagePolicy: current`
is planned correctly, `loadAgentCurrentImageReferences` is never called, and the
model receives text with no image attached. Asked to edit an image it cannot see,
it answers in prose. That prose is a message-only stream, which
`classifyNoImageResponse` labels `IMAGE_TOOL_NOT_CALLED` / `EMPTY_RESPONSE` — both
retryable — so the runtime retries once with a forced-image prompt, fails the same
way, and reports the generic artifact error. **The reported symptom is the last link
in the chain, not the defect.**

Repro C (`tests/tmp-repro-192.test.ts`, temporary): turn 1 creates a session image,
turn 2 asks for an edit with `sourceImagePolicy: "current"`, and the outgoing
Responses body is inspected for `input_image`. Result: `carriesImage=false`.

## Secondary defects found by the audit lanes (in scope, same failure story)

1. **Queue path loses the cause.** `lib/agentQueueWorker.ts:182` builds a failure
   object including `rawCode` via `errorEnvelopeFields`, but
   `lib/agentQueueStore.ts:185` accepts only `{code, errorClass, message}` — there is
   no `rawCode` column, so it is dropped. The Agent composer uses the QUEUE path
   (`ui/src/lib/agentApi.ts:100`), so the user sees only the generic wrapper. The
   existing regression test only covers the direct `/turns` route, which is why this
   was never caught. This is exactly the issue's "cause preserved" requirement.
2. **Empty images accepted as success.** `lib/agyImageAdapter.ts:373-393` and
   `lib/atlasCloudImageAdapter.ts:181-183,234-240` return `b64: ""` on a 0-byte
   artifact/body. `persistAgentImage` does not guard it, so a 0-byte file is written
   and registered as a real image. A silent empty artifact is worse than an error.
3. **`STREAM_PARSE_FAILED` is not retryable** while every sibling no-image code is
   (`lib/agentRuntime.ts:373-379`). Recorded as a deliberate NON-goal: it means the
   stream was malformed, and a blind retry is not obviously right. Left alone.

## Fix plan (wp2)

See `010_fix.md`.

## Source-text contracts guarding these files (must not break)

`tests/nai-routing-contract.test.ts:84` asserts NO `generateViaNai(...)` slice in
`lib/agentImageVideoGen.ts` contains `references:` — so the new reference wiring must
stay outside the nai branch. Also pinned: `tests/agent-video-reference-contract.test.ts:43`,
`tests/comfy-routes-contract.test.ts:217`, `tests/structured-filename-pipelines.test.ts:248`,
`tests/agent-mode-right-sidebar-contract.test.js:182`, and
`tests/model-default-projection-contract.test.ts:30`.
