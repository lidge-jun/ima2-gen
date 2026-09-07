# WP06m C — source mutations and first candidate

Source4b5d8579: main removed the pre-copy byte guard, pending-read abort race and
post-reader public abort check in separate real mutations, rebuilding JS each time.
Each intended verifier failed (overflow returned success, pending abort hit the
test watchdog, late wrapper abort returned success). Exact restoration passed;
git diff lib/routes was empty. The old whole-body API was already demonstrated by
the16byte P probe. Whole-operation tracker omission was separately RED/restored
GREEN. No mutation remains.

First CI33968140044 at4b5d8579: Node24 and frontend39 passed; Node22 failed two
following-test hooks after optional FFmpeg tests skipped. The exact error was
Video fixture is not idle, not a production download failure. Node22's in-body
skip omitted the afterEach cleanup in this path. All four optional-codec exits
now await finishCase before calling skip, preserving explicit unavailable status.
Local Node22.22.3 with PATH=/usr/bin:/bin (no FFmpeg) passed the three affected
files; this is a compatibility reproduction, not exact hosted22.23.0 proof.
Fresh exact-tip CI remains mandatory. Real-codec local tests are verified separately
and skips never count as codec success. No guard/header/production change here.
