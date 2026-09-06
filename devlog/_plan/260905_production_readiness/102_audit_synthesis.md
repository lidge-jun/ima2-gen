# WP10 A — four blockers accepted, bounded amendment

AuditorGoodall01a074c0-672a-7942-a2e4-85640b0f5cb7 FAIL at29eac949, baseline6pass
andboth typechecks0. Main accepts allfour; no production edits before A closes.
This document overrides conflicting100/101 clauses without expanding product scope.

| Blocker | Root cause | Accepted correction and existing verifier |
| --- | --- | --- |
| URL after=delimiter survives | Protocol-relative regex permits whitespace/quotes but not common diagnostic separators. | Logger's same private replacement also recognizes=,[,{ before//; preserve delimiter, replace whole token. Existing logging.test.ts corpus adds literal url=//user:opaque@example.invalid/p and bracketed variant, exact marker-free output. No URL parser/network/dependency. |
| null config prevents fixed report | config.ts loadConfigJson accepts any parsed JSON before fileCfg.promptBuilder access. | At that existing root read, accept only non-null object/non-array; other JSON shapes become{}. Doctor independently reads and validates root, reporting CONFIG_INVALID/fail/exit1. All valid config objects retain current semantics. No general nested config schema. |
| unknown fail becomes warning/exit0 | Unconditional unknown-code warning loses original failure intent before summary. | Code/message stay fixed DIAGNOSTIC_UNKNOWN; preserve fail if incoming kind is fail, otherwise use warn. Unknown code can never emit pass. Summary uses emitted checks and fails1 for that case; exact report test. |
| key body escapes deadline | Status-only fetch branch releases timer without cancelling response body, while exitFlushed drains the event loop. | Keep abort deadline until response.body.cancel completes on every HTTP status; classify cleanup/abort failure safely. Existing provider fake-fetch cases prove status/body cancellation plus timeout distinctions, no raw payload. No new transport framework. |

Field chain: incoming DoctorCheckLine.code/kind → fixed table or fixed unknown
code with fail-preserving kind → checks JSON → summary.failed/exitCode → stdout
and exitFlushed. Bundle consumes these sanitized emitted rows, not legacy text.
CONFIG_INVALID stays a report entry; config import's{}fallback cannot silently
make malformed standard doctor configuration successful.

Resource and scope constraints remain101/098. Only the preplanned logger worker
(logger.ts+logging.test.ts) is delegated after A approval; main owns CLI boundary.
Re-audit with the same reviewer before B, with these explicit dispositions.
