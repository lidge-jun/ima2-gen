# WP12 C — observed UI and scoped path repair checks

Diagnostic candidate cc304e80 fullCI34026172889 completed SUCCESS in all six
jobs: Linux22/24, Windows22/24, macOS installation and frontend. This predates
User-Agent, ancestry and current C repairs; it cannot certify the final SHA.

Downloaded owned artifact9987403106, wp09-journeys-cc304e80-34026172889-1
(full artifact name includes full SHA),14660353bytes. Main directly opened
wp12-generated-desktop.png, wp12-held-desktop.png, wp12-restored-mobile.png and
wp09-t2-reload.png from /tmp/ima2-wp12-visual.DN1P4m. No local app/browser launched.
J5 JSON binds cc304e80/run34026172889/attempt1/build:fixture success; one completed
result, one canceled request, one upstream reply, zero submissions on restart,
both guard checks and resource closure true. The generated image is a1x1 fixture:
this proves identity/loading/persistence, not useful image-quality or canvas-scale
evidence. Desktop/mobile controls and restored gallery state were observed.

Held popup was captured mid-opacity transition. Main read inflight-tray.css's
positioned=true opacity1 rule and added an observable CSS-opacity wait before that
capture. No arbitrary sleep, animation override or production style change.
NovelAI reload screenshot shows both drafts and the visible action area; final
geometry/visual acceptance still requires the amended candidate's existing J7/J8
evidence. Do not substitute this diagnostic capture for latest-head acceptance.

H3/H4 owned file tests initially failed on the unchanged production source: root
resolution accepted directories and restore reached a refused mutation spy. No
real OS-trash/user-file operation occurred. After production prechecks, invalid
cases passed; valid restores exposed only a fixture identity mismatch between
macOS /var and /private/var. Canonicalized the newly created temp root itself
before writing any fixture paths; did not broaden allowed directories.
Final focused result:7pass/0fail, including root/root-sidecar preservation,
source/destination directory-link rejection, dangling/dir sidecar rejection before
mutation, normal/nested restore, missing sidecar, flat fallback naming and ordinary
permanent delete. Existing history source contracts5pass/0fail. Source/test types
passed at that partial tree. Independent same-reviewer closure is pending.

H2 worker delivered random concat temp naming and cleanup ownership repair plus
five existing-owner regressions. Scoped types passed; real ffmpeg remains in the
test graph, so runtime is hosted-only and has NOT been claimed passing locally.
H1 format repair and all final-head CI remain open. No high findings are waived.
