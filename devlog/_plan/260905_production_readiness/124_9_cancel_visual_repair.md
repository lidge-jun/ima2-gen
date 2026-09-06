# WP12 C — canceled work must not display a generation failure

Candidate b8cba34e passed full CI34030456454 and PR34030460811. Its J5
wp12-canceled-desktop.png nevertheless visibly shows `Generation failed.` while
wp12-journey.json records canceled/GENERATION_CANCELED, one preserved image and
zero new submissions after restart. Main opened the original screenshot.
CodeQL101–104 were owner-approved false positives only after those tests passed;
their disposition does not establish visual acceptance. Other57 alerts unchanged.

Bounded hypotheses and falsifiers:

- H1: local AbortError is misclassified by classic generation's catch. Falsify
  with the real public store cancel action in the existing isolated UI fixture;
  a fresh toast proves it is not a stale screenshot. Compare typed server cancel.
- H2: the server emits an ordinary failure instead of cancellation. Existing J5
  terminal and pipeline records contradict this; direct typed server-cancel input
  must remain silent while an ordinary error stays visible.
- H3: this is an unrelated prior toast. Use fresh store state and one submitted
  request, then compare local cancel, server cancel and genuine failure outcomes.

Scope: existing classic catch in ui/src/store/storeGenImpl.ts, existing
job-tracking-timeout-ui test owner, and existing J5 acceptance assertion only.
No new helper, fixture, runner, timeout, scanner exemption or global error policy.
Retain genuine provider/tracking failures, cancellation request and finally cleanup.
The old unclassified MCP timeout remains a separate blocking obligation.

Confirmed mechanism: storeUIImpl cancels the owned AbortController before DELETE;
api-generation rejects with DOMException(AbortError). Classic's catch recognized
only server code/status cancellation, unlike multimode's existing AbortError
branch, so errorHandler mapped the local abort to UNKNOWN/generation-failed.
The fresh real-store probe reproduced exactly one erroneous toast for local
cancel; typed server cancel remained silent, ordinary INVALID_REQUEST still
created an error card, and tracking expiry still produced its warning. Thus H2
and H3 do not explain this defect. Early probe expectations were corrected to
count the existing errorCardLog as well as toastLog; no production change occurred
until the four-case probe had exactly one failure (local cancellation).

Repair: recognize AbortError only in the existing classic catch, keeping all
ordinary/tracking failures and finally cleanup unchanged. J5 reads rendered error
toasts immediately after settlement, not by waiting for their expiry. New runtime
candidate requires full current-head CI and a newly opened canceled screenshot;
b8's green automation and failed visual remain preserved as baseline evidence.

Focused result: four classic settlement cases now PASS (local/server cancel,
ordinary error, tracking expiry), no fixture violations/pending work/listeners.
Source-test and E2E typechecks PASS. Independent visual reviewer confirmed the
original wrong toast; source re-review and fresh hosted visuals remain pending.

Geometry review: eight original composer captures plus one navigation capture
confirmed stable negative heights and measured grid-to-action separation. It also
reported isolated Korean sentence endings (`다.`/`니다.`) in helper copy. Main
opened home390 short and confirmed visible complete text, not clipping or lost
controls. Per owner's product-first scope lock this cosmetic wrapping observation
is recorded as follow-up, not expanded into a typography redesign or new gate.
Bottom negative pixels are not visible in the selected initial-scroll captures;
existing separate controls evidence supplies reachability, not unobserved pixels.
