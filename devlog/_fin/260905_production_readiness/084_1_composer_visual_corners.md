# WP08 C — observed pane boundary discontinuity

Main directly viewed52baseline current-CSS screenshot
`wp08/ci-52fe86fb/j7-nai-negative-geometry-W-4de83-lling-contrast-and-controls/wp08-j7-s1-sidebar-dark-final.png`
under session evidence. Geometry and contrast assertions passed, but each classic
pane border has disconnected horizontal/vertical endpoints at its roundedcorner.
This is a visual defect, not a reason to weaken the contrast threshold.

Source cause: both classic pane skins use clip-path inset(0 round var(--r-md))
while their border remains square. The stronger identifying border exposes the
corner clipping. The depicted composer-panes CSS blob is unchanged at0f/298;
52 is defect evidence, NOT finalcurrent-headPASS. Keep its bytes immutable.

Repair only existing .composer__prompt-panes--dual .composer__prompt-pane and
.negative-prompt--classic incomposer-panes.css: add border-radius:var(--r-md).
Keep clip-path, borders, padding, floors, flex/grid/scroll and allfocus rules.
Use the same existing8px token; no new token or globalradius normalization.
No change toHome effective--r-xl or any of477existingradiusdeclarations.

The earlier no-new-radius inventory constraint is amended by this actualvisual
finding: addexactly2named rows to tests/fixtures/contracts/radius-scale.manifest.json,
update tests/ui-radius-scale-contract.test.ts frozen count477→479 with causal
comment. Allpreviousrows remain. Add explicitpane radius assertions toNAIASTtest.
Run exactradius+NAIcontracts andfullcurrent17file receipt. FinalhostedcurrentPNG
must show continuouscorners and bothindependentoracles check them beforeD.

Native52baseline:144E2E total,44expectedIME/mention failures and100PASS (including
all16geometries). Downloaded205PNG and77inputJSON:44failureobjects, all77traffic/
teardownclean.16geometryJSON:requests0/denied0/unexpected0/stub0/teardowntrue,
allfourfallbackportsECONNREFUSED. Actualcomputedminimumplaceholderandboundary
5.37369961372217. Policyselftest3intendedPOSTaborts/0accepted/0continued/0unexpected,
allresourcesclosed. Summary in52fe86fb-native-summary.json. Actualnative44RED is
established; currentguardedheadGREEN stillpending. These results are notwholeAA.

Follow-through task registered forWP09 realjourneys: interruptedcomposition across
provider/focus/tab/remount transitions. Stale local composing-ref lifetime is an
unverified hypothesis, not a confirmedbug or a claimedfix. WP08 covers registered
same-field ref/native/229 andcompletedcomposition sequences; WP09 broadens actual
cross-surface journey activation before production release. Keep this visible.
