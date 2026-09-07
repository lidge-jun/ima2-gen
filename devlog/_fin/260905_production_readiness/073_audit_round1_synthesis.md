# WP07 A — round 1 synthesis

Reviewed9c95c41d; no production implementation. Euclid server audit FAIL (S1–S4),
Parfit UI/CLI audit FAIL (U1–U5). Its later video-lifetime note refines U4, not a
sixth finding. Main read the complete first verdict as well as the follow-up.
All findings accepted; 074 is the concrete replacement contract before re-audit.

| ID | Cause and accepted correction | Proof needed |
| --- | --- | --- |
| S1 High | purge could overwrite a canceled record after a failed active-row DELETE. Preserve a retained terminal when cleaning residual active rows; define memory/disk precedence and transaction behavior. | DELETE-failure -> recovered purge, same timestamp/status, no new event, before/after fresh restore |
| S2 High | immediate destroy on write(false) can discard a healthy peer's buffered replay and repeat the same cursor forever. Add bounded drain-driven replay/live catch-up using only the global ring. | native small-HWM writable/reconnect progress, one POST, eventual terminal/recovery plus deadline/teardown |
| S3 Medium | expiry parsed JSON meta instead of existing column-first rowToJob metadata, losing scoped IDs. Reuse actual row conversion. | column-only/conflicting IDs and scoped terminal lookup after restart |
| S4 Medium | Sprite tracked expiry reaches a data.message-only subscriber and error never unsubscribes. Include parser/localized message and terminal cleanup. | real public Sprite action/subscriber, one warning/settlement, no late mutation; reload boundary explicit |
| U1 High | adding UNKNOWN/raw recognition while returning registered left code/spec UNKNOWN. Return literal canonical tracking code/spec/message. | direct/UNKNOWN/unregistered wrappers and known-code conflict controls through nodeRetryAction/handler |
| U2 High | parser and settings could retain UNKNOWN/poisoned text despite toast resolver protection. Reuse resolver recognition to canonicalize tracking at parser/settings; localize asset error state too. | actual AssetGen state/render and MCP callback/submit routes with poisoned metadata |
| U3 High | extension's error state still renders Retry. Add source-bound tracking-expired advisory state with disabled submit and explicit source-change reset. | native rendered tracking/ordinary error/source-switch states, no automatic POST |
| U4 High | introduced video errorInfo survives pending/success/cancel/ordinary failure and serialization. Clear it on those transitions, only set fresh tracking data on tracking failure. | sequential same-node attempts and pending save/reload; preserve settled historical errorInfo |
| U5 High | SSE response held until POST deadlocks a caller that waits for EventSource OPEN; extension202 omitted required fields. Use an owned live streaming test fixture with headers before POST and correlated terminal afterward. | native OPEN -> exactPOST -> terminal; full202 sourceVideoId/workflow, no mocked EventSource, bounded teardown |

## Cross-blocker reconciliation

S2 and U5 share a transport truth: accepted writes and headers are not delivered
terminal outcomes. Tests must expose actual readiness/drain ordering, not finite
response stubs or synthetic headers. This replaces the destroy-on-false and
SSE-after-POST assumptions, rather than adding retries to hide them.

S1 joins the cancellation-before-abort design: retained terminal state dominates
residual cleanup, while ordinary new admission deletes that old state atomically.
No generation-epoch/scheduler redesign is added. S3 reuses active-row correlation
semantics instead of creating a second interpretation at expiry.

U1/U2 share the existing pure resolver as canonical recognition. Known genuine
nontracking codes retain precedence; accepted tracking wrappers become the literal
tracking code with safe message before direct raw-message consumers see them.
U3/U4 track the newly added presentation state through its real lifetime instead
of only testing the first error toast. S4 is a real omitted consumer, not a reason
to claim all queue/upscale/recovery consumers are handled.

The initial P's baseline24, lifecycle, polling and channel probes remain valid
defect evidence. A-gate remains closed until the same reviewers inspect074 and
its synchronized owner/manifests. No FAIL has been attested as approval.
