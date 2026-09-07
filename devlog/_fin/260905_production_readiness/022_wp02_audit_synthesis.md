# WP02 A round1 synthesis

State reviewer Tesla01a06fcf-6072-7752-889a-5aaffb867ea0:
GO-WITH-FIXES, one Medium design ambiguity. Its attempted bundled probe failed
during initialization (undefined.model); no behavioral execution is counted.
Main's earlier actual setter probe remains separate valid baseline evidence.

Accepted finding: current/next state alone cannot distinguish image selection
that retains an inactive Comfy video slot from explicit setComfyVideoWorkflow(null)
that must erase that slot. Both can yield the same active state. Private commit
must carry explicit intent; saving must replace supplied lane records so deletion
cannot be reversed by a second slot-level merge in the storage boundary.

Amend020: commitSelection(current,next,set,clearSlot?:"image"|"video") merges
remembered current/next slots normally, then deletes clearSlot from next.provider's
lane record before save. Only explicit null workflow actions pass clearSlot.
saveCoreSelectionMemory merges known provider records but REPLACES any supplied
lane record wholesale after validation; absent provider entries remain intact.
Add paired real-action tests from identical Comfy imageA/videoV states: imageA
selection retains inactiveV; video-null deletesV; leave/return respects storedkind.
Same symmetric image-null test removes onlyimage while retaining inactivevideo.
No new public type or on-disk shape; no conflict with display/request worker.

Surface reviewer Mendel01a06fcf-6197-7c02-a250-311e54686caf: PASS, no blockers.
46 focused baseline tests0; actualAppState+both transport caller CompilerHost
overlay gives required-input TS2345x3 and proposed optional-input/wire-string0.
J6 isolated-hosted capture design is feasible; baseline startApp alone is not
isolation proof. No browser execution claimed in A. No external fact lookup needed.
