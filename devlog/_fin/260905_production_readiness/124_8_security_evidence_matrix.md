# WP12 C — consolidated security evidence matrix

This supersedes the provisional caller descriptions in124. It records source
dispositions, not a blanket scanner waiver. Latest observed analysis1731667452 at
a5812b0d71de9266b98e0f029362a6a67a6fe1da reports61open results, no analysis error
or warning, all instances on that SHA. Snapshot: wp12/a581-codeql-alerts.json.
Earlier analyses and removed IDs remain evidence, not a count-based acceptance.
The final candidate's full CI/PR/artifact proof is still required.

| Original/current IDs | Actual boundary and disposition | Independent evidence owner |
|---|---|---|
| 1,2,3 | Reachable suffix/frontmatter work repaired with scans; no blanket claim all parser regexes are linear. | prompt-candidates-normalization, canvas-version-normalization, prompt-import-folder-contract; source reviews and earlier bounded reproduction. |
| 5..8 | HTTP(S) URL only, no interpolated command shell; direct argv or fixed PowerShell command carrying base64 data. | platform-open-url per-platform mocks and metacharacter round-trips. Personal Windows native child launch was EPERM; do not claim a successful native PowerShell/browser run. |
| 15,16,101 | Real GitHub/MCP/Grok download callers validate destination before every request, consume pinned DNS answers, cancel redirects/rejections and bound streamed bodies. Only configured Grok proxy receives its exception. | Singer exhaustive direct-caller audit; address-policy53passed; download/retry/GitHub negative owners; native pinning owner remains in fullCI. |
| 95 | Gemini variables occur after a fixed HTTPS Google authority; hostile model/project strings cannot change initial origin. | Singer memory-only full-source probe18initial-origin cases; existing Gemini wire/auth tests. Google-controlled redirects were not adversarially reproduced; no user-controlled redirect producer was found. Not a general redirect/DNS-confinement claim for every provider. |
| 17 | Auxiliary OAuth spike emitted raw error HTML; now nosniff text/plain. | Existing spike contract6passed; no live OAuth run. |
| 19,20 | Actual sinks are Buffer checks, not filename/kind fields. Non-Buffers short-circuit before length/subarray; import also maps non-Buffer body to empty and rejects before save. | Zeno source review; new existing-owner JSON/fake-Buffer/array cases in local-import and asset-derived, executed in366rootCI. No new production parsing policy. |
| 21..30 | Root/directory trash and unsafe restore were genuine. Strict descendant plus regular-file checks, flat fallback name, and canonical media/sidecar/destination-parent preflight now precede restore moves. | asset-lifecycle-path7passed; history source5passed; real history/stitch-related hosted results. Zero-mutation claim is for restore preflight, not every old permanent-delete error ordering. |
| 31..35 | Template ID regex excludes separators before the first package read; preview/base leaf names are basename-constrained. Registry membership alone was not the first-read guard. | card-news-contract bad-ID negative and package asset tests; Boyle source mapping. Package root/files are trusted installation inputs, not an HTTP-writable sandbox. |
| 36,51 | MCP stitch requestId no longer determines temp path. Crypto-minted flat output, concat-error cleanup, then exclusive commit cleanup before done. | mcp-media-action five new hostile-ID/error/cleanup cases observed passing on fae Windows24; ordinary stitch retained; source closurePASS. |
| 37,38 | Compiled provider identifier guard runs before snapshot path construction/read. | mcp-security-regression guard/corrupt-cache and snapshot-pipeline owners; caller/guard source trace. Configured snapshot/package roots are trusted; no arbitrary-root capability exposed. |
| 39..45,100,102..104 | Node format injection repaired before API/OAuth execution and again at save; full image/sidecar paths are checked. Existing image and metadata readers now canonical-check before bytes, including parent fallback. New104 is the realpath inside this check, not an unchecked content read. | provider-execution-node30; node-store-metadata20after canonical repair, both byte readers and fallback/outside-read spy; Huygens/Boyle/Singer reviews. No unnecessary ID character allowlist remains. New server-minted write IDs do not establish atomic filesystem-race protection. |
| 46 | Reported rename is the explicitly enabled test-trash seam; production OS-trash caller receives validated file paths and uses glob:false. | history-tombstone actual seam behavior; assetLifecycle caller review. This is intentionally a trash move, not a promise all destinations stay generated/. |
| 47 | Video input realpath result is bounded before MP4 parsing/content reads. | Existing videoExtendedRoute symlink case now requires exact canonical error, no longer accepts an unrelated invalid-MP4 rejection. Hosted execution of the stronger assertion remains required. |
| 48..50,52,53,94 | Lexical source resolution precedes existence probes; regular/canonical checks precede substantive asset/derived/keying processing. Directory/root regularity was repaired with21..24. | asset-derived/assets-routes/backend-hardening and video owners plus the shared regular-file negatives. An existence probe is not a content read; check/use race immunity is not claimed. |
| 54..57 | Video trim uses an alphanumeric/underscore/hyphen normalized requestId before temporary filename construction. Request path traversal characters cannot survive. | Boyle actual trim-source mapping. No claim of canonical/no-follow protection against an independent local actor preplacing files in shared temp storage; that is not the reported HTTP lexical-injection path. |
| 58..90,92 |34production registrations are covered by actual global API admission before parsers/handlers; socket identity cannot be spoofed by forwarded headers, counters/memory are bounded. Custom middleware need not erase scanner warnings. | Zeno coverage audit; pure budget5passed including native Windows. Existing backend owner now exhausts real configured allowance and checks429before malformed JSON parsing; current hosted result required. This is app API admission, not distributed DDoS protection. |
| 13 | Actual config CLI checks fixed writable-key Set; defaults use fixed keys or exact image/video target gates. No hostile key reaches helper in those callers. | Pure configKeys probe rejected5prototype keys; all37allowed paths lack prototype segments; source caller inspection. Does not certify arbitrary trusted code directly calling the low-level helper. |
| 4,9..12,91,93 | Fixture/mock/assertion sites, not production routing/sanitization. | Exact source locations and package files allowlist excluding tests; root contracts still execute unchanged. No SAST exclusion or alert dismissal. |

Known guard-limit distinctions are deliberate: package/operator configuration is
trusted; generated content selected through app routes receives the documented
path checks. No atomic safety against concurrent privileged filesystem replacement
is claimed. No discovered HTTP-triggerable High/Critical path is silently deferred.
New evidence contradicting a disposition reopens it; source age is not a waiver.

Historical original MCP timeout is separate from CodeQL. Its cause remains
unclassified; reproduced first-frame recovery is fixed. Owner was asked separately
whether a fully passing current candidate may retain that historical event as an
open follow-up. Silence leaves the original blocking criterion intact.
