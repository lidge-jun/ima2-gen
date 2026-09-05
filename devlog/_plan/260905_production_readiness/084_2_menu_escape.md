# WP08 C — native Escape must carry dismissal intent

298CI33985139362 E2E:143PASS/1FAIL. All44originalIME/nativeEnter regressions now
pass. Solefailure composer-input.spec.ts205: afterEscape closesmenu, click on the
unchanged`@` field reopenslistbox(expected0,actual1). Rawjob101357156643 names the
exactassertion, not a timeout-budget issue. Do not remove/relax it.

RCA: Menu's nativekeydown invokes onClose/setMentionQuery(null) before the parent
React handler can reliably retain the openquery snapshot. The existing React
Escape branch alone does not own the whole event chain. Earlier placement of
defaultPrevented insideEnter avoided one hazard but did not preserve the native
close reason across scheduling. This is the first real repair of this failure.

Repair existinginternalprop, no secondescape dispatcher: ElementMentionMenu
`onClose(reason?: "escape"):void`; nativeEscape calls onClose("escape"). Existing
position/ref-loss calls remain onClose() and existing zeroargcallbacks compatible.
PromptComposer onClose records dismissedMentionKeyRef from the currentquery ONLY
forreasonescape, then setsmentionQuerynull. Retain ReactEscape branch and IME/229
guards, Tab/arrows/Enter behavior unchanged. No props added to publicCLI/API/store.

Field chain: reason literal created by Menu nativeEscape → directReactcallback →
PromptComposer optionalargument → query-key suppression → existingtext-change
resetsuppression. Serialization/deserialization:N/A, component-only typedcallback.
Undefined(reasonlesslayoutclose) does not setstickysuppression. No newpersistedfield.

Files: Menu/PromptComposer +existingEM-06sourcecontract expecting escape reason.
Existingreal77component tests include failingEscape→click; finalnativehead must
pass the unchanged205assertion. Mainretains499linePromptComposer with whitespace
reflowonly. Exactmention/NAI/feedbackcontracts andbothUItypes/build beforecommit.
No localbrowser, providercall or reset. Currenta5CI mayfinishwithsameknownonefail;
newfinalheadwillneeditsowncompleteproof/pixels includingcornerrepair.
