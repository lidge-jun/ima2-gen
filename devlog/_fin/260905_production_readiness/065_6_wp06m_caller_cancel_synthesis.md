# WP06m C — caller cancellation coverage closure

Caller reviewer at4b5d8579 found no product defect but identified missing real
download-stage cancellation cases for generate/edit/native extension/last-frame.
Existing extraction/preflight cancellation and Agent held-read cancellation cannot
stand in for these four paths. Accepted as a verification blocker.

Main adds tests/video-download-cancellation.test.ts, keeping near500-line existing
test files bounded. Actual route registrations, generator, downloader and persistence
remain real. Only upstream responses and the existing last-frame extraction seam
are synthetic. Each case reaches the held artifact reader before cancellation.
Generate/last-frame cancel through actual inflight API; blocking edit/native cases
cancel their owned HTTP client and observe the server's download signal and handler
settlement (a disconnected client cannot receive a successful JSON response).

Before finishCase can perform cleanup, drain actual handler/whole-operation work;
assert no new MP4/sidecar/done, one generation POST/poll/artifact request, no
arrayBuffer use, reader cancel/unlock, and unchanged last-frame parent bytes.
No large body, real provider, FFmpeg requirement or production behavior change.
Same caller reviewer verifies these exact additions before C closure.

Main replay: all4 cases pass after correcting the native-extension fixture duration
from1 to5 (its existing valid range is2..10). The initial wait timed out because the
invalid fixture request returned400 before reaching download; no product defect.

Manual curl independently observed generate cancellation emits two499 terminal
errors, from abortJob and routes/video.ts650. Both files compare unchanged from
9c87c943. This is an inherited caller terminal-policy issue, owned by WP07's
exactly-once goal, not a new body-bound correction. Keep its raw replay and explicit
OPEN WP07 finding; body-safety acceptance records actual two ordered cancel errors,
no done/output and correct reader/handler settlement. Do not label deduplication
fixed or silently waive the later release requirement.
