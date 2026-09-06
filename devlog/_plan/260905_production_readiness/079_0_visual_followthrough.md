# WP07 C — observed warning presentation repair

Main directly viewed CI84 wp07-asset-ko.png (1280x800). Two real defects survived
DOM text assertions: a completion-unknown warning sat under "generation failed"
and a generic model/key retry hint; the bottom error toast ellipsized the warning.
This is observed visual/semantic evidence, not a guessed style improvement.

## Chosen bounded repair / rejected alternatives

Do not infer machine codes from translated text. Adding a second transient error
code field would require a new state chain solely to render a generic heading.
Instead make the existing AssetGen error heading neutral for ALL displayed errors:
"Generation notice" / "생성 안내" / "生成提示" / "生成提示". The body remains the
specific existing safe error or unknown-completion warning. Remove the generic
retry-settings hint from rendering; it is not valid for every error. Keep its
dictionary key for compatibility, without claiming it still renders.

For toasts, reuse existing .toast--card CSS presentation whenever row.error is true
(currently only kind=error-card gets it). That established layout already wraps
text, gives the dismiss button44px, bounds width and makes the stack scrollable.
No new CSS owner/override, metadata field, message parsing, timeout or dependency.
Success toasts retain their compact appearance. No Retry CTA is added: CTA rendering
still depends on kind=error-card and the existing reauth/reload branch.

## Exact file changes and checks

- MODIFY ui/src/components/assetgen/AssetGenWorkspace.tsx: remove only the generic
  assetgen-error__hint span; preserve message, dismiss, generation controls.
- MODIFY ui/src/i18n/{en,ko,zh-Hans,zh-Hant}.json: replace assetGen.errorTitle literals
  with neutral labels above, no key shape changes.
- MODIFY ui/src/components/Toast.tsx: include toast--card when row.error, retaining
  kind and CTA semantics. Existing stylesheet remains untouched and authoritative.
- MODIFY ui/e2e/j7b-tracking-timeout.spec.ts: assert neutral title/no generichint,
  full visible toast text with DOM geometry at initial live state, and existing
  persistent-alert fivewidth matrix. Preserve ordinary/cancel/success controls.
- Existing tests/toast-stack-contract.test.js already pins the wrapped CSS, stack
  bounds and dismiss/CTA geometry. No existing SSR Toast runtime fixture was found;
  do not add one solely for this. J7b now asserts actual visible text rects, overflow
  and whitespace plus no CTA, with native screenshots. That is the render oracle.

Verification: dictionary coverage, existing toast/provider/UI tests, source/test/UI
types and builds; fresh native J7b screenshots/metrics at finalHEAD. Newerror layout
changes pixels, so prior84 screenshots are defect evidence, never finalPASS.
Allchangedfiles stay below500lines; no edit to oversized storeTypes or globalCSS.
