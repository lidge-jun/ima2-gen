# WP11 C — fast native Windows results

Hostdesktop-c795oh4, Tailscale100.79.88.1, Node24.19.0; task-only root
C:\Temp\ima2-wp11-01a06e88-ViFXzI. No existing checkout, account, business data,
global package install or service was modified. Copies came fromd22c0a19 plus
the explicit current candidate source files. These are diagnostic results, not
a substitution for pinned final-head CI. Local source/evidence remained preserved.

- Baseline2target tests:0pass/2fail, UI_RECEIPT_BUILD_CHANGED in~0.2sec.
- Fresh-fixture A/B/A: sameRoot=true throughout. No first directory read fails;
  reading only ui/public/fonts during fixture preparation succeeds; no read
  fails again. Native watch events name src/public/fonts directories. This
  rules out root aliasing as this watch failure's cause.
- Minimal fix: one readdir during existing fixture setup. Production watcher,
  null-filename/error rejection, input snapshots and edit/revert checks unchanged.
  The two targets pass, then the entire existing transaction file17/17passes,
  0skips, exit0 in8.41sec, including actual watcher edit/revert, Git changes,
  compiler failure/cleanup, tamper and abandoned-lock scenarios. One intermediate
  subset-copy run failed solely because write-ui-build-receipt.mjs was missing;
  the unchanged source file was copied and the complete17-case run followed.
- Native child env: old helper exits1 with injected=true/cleared=false; candidate
  exits0 with injected=true/cleared=true. Parent USERPROFILE unchanged in both.
- Owned Windows long/8.3 alias probe: same dev/ino, old relative path nonempty,
  canonical relative path empty. Canonicalize the newly allocated execution
  fixture root before deriving config/media paths; no containment exception added.
- Corpus irm-iex-kills-host informed changing installer Fail from exit to throw.
  Standalone and IEx regression remain mandatory in hosted CI. Personal-host
  wrapper invocation was policy-blocked, not accepted as RED/GREEN evidence.

Confucius01a07557-e7fd-7140-a0f6-7805090815a2 independently reviewed this small
repair diff and found no actionable defect; it made no runtime claims. Main
reviewed code and directly read native outputs. Existing untracked recording
files and all prior CI failures remain preserved. Next: final grouped CI/CodeQL,
then WP11 closure. Owner requested asynchronous work, so a read-only candidate
security triage may prepare later WP12; revalidate it in that WP before acceptance.
