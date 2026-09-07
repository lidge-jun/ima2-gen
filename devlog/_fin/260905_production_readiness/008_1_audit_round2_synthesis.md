# WP00 A round2 synthesis
All eleven R1 blockers closed at design level by the same three independent reviewers.
Round2: three GO-WITH-FIXES verdicts; no High/Critical, six Medium issues. Main accepts
all six and repairs before roadmap lock; no scope/verification downgrade and no code.

| ID | Root cause / evidence | Accepted repair |
| --- | --- | --- |
| R2-B1 | 030 E03-4 expects duplicate Responses callbacks, but responsesParse.ts:334 dedupes identical b64 before callback | Reachable upstream finals A,A,B with distinct A/B bytes -> callback[0,1], two persisted outputs. Preserve parser; Grok distinct-index identical bytes remain G05-7. Main030. |
| R2-B2 | 050 PinnedImageResponse cannot satisfy real grokFetchWithRetry Response; TS2322, 503->200 cancels0 | Narrow shared retry-response structural contract+generic return and explicit non-buffering pinned response adapter with body.cancel forwarded. Preserve existing Response callers, retry counts/Retry-After/abort/no POST retry. Backend repair050. |
| R2-S1 | 090 I6 expects assertClean reject an expected existsSync fallback denial | Real startup verifies expected denial and zero poison content reads/copies; separate explicit forbidden content read yields unexpected denial and assertClean failure. Fixture090. |
| R2-S2 | UI projection requires nonexistent exact-revision asset receipt | WP09 owns a concrete post-build producer/schema/path and whole dist regular-file inventory including HTML/public fonts; consumer matches source revision/input digest and asset bytes. Missing/stale proof remains fail closed. Fixture090 with standalone build integration; main120 consistency. |
| R2-S3 | 111 promises previous-release Pages dispatch but guard/finalize-check requires npm latest | Document forward-repair-only Pages recovery under exact-release gate; preserve previous live site until new gate passes, never move latest backward or weaken olddoctor/provenance checks. CLI rollback to old immutable installed package remains separately possible. Main111/009/130. |
| R2-U1 | 070 captures local jobs before await then overwrites concurrent Generate additions; reproduced1->0 | Prefetch snapshot only determines request scopes; after response re-read memory/storage, preserve concurrent new/replaced jobs and do not resurrect jobs removed while waiting. Add held-response tests plus expiry restore. Ops070. |

Reviewer IDs remain008's same three. Scoped backend round2 diff hash
2e9456813da81269e9b896c6c7141eab3f9d53922a3e8d3d924d9a733e38d749;
global staged round2 hash5b69007ce80b98ad00141b7f62f0b46311cdf6eb96934f04dc0823bcf21aa38d.
Each reviewed a stable assigned snapshot and distinguished baseline tests from
future implementation. No browser/live provider/full-suite/source mutations.

Conflict resolutions: no Responses content-dedupe change to satisfy an impossible
test; no new retry policy to adapt transport shape; no synthetic guard expected
denial counted as a real exposure; UI proof gets an actual producer in its own WP;
Pages recovery wording must be executable under its gate; scope discovery is not
permission to freeze async state. Next: stage repairs and same-reviewer closure.
