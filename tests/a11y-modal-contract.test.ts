import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// WP1 (devlog/_plan/260726_zero-backlog-frontend-qa/010_a11y_foundation.md):
// every dialog surface must declare modal semantics and delegate focus handling to the
// shared hook. Rolling your own Escape listener drops focus trapping and focus restore,
// which is exactly the regression this contract exists to prevent.

const DIALOG_SURFACES = [
  "ui/src/components/PromptDetailModal.tsx",
  "ui/src/components/GalleryModal.tsx",
  "ui/src/components/CustomSizeConfirmModal.tsx",
  "ui/src/components/OnboardingPopup.tsx",
  "ui/src/components/ProviderReadinessPopup.tsx",
  "ui/src/components/MetadataRestoreDialog.tsx",
  "ui/src/components/ApiDisabledModal.tsx",
];

test("dialog surfaces declare modal semantics", () => {
  for (const path of DIALOG_SURFACES) {
    const src = readFileSync(path, "utf8");
    assert.match(src, /role="dialog"/, `${path} must declare role="dialog"`);
    assert.match(src, /aria-modal="true"/, `${path} must declare aria-modal`);
    assert.match(
      src,
      /aria-label(ledby)?=/,
      `${path} must name its dialog via aria-label or aria-labelledby`,
    );
  }
});

test("dialog surfaces use the shared focus hook", () => {
  for (const path of DIALOG_SURFACES) {
    const src = readFileSync(path, "utf8");
    assert.match(src, /useModalFocus/, `${path} must use useModalFocus`);
  }
});

test("dialog surfaces do not register their own Escape listener", () => {
  for (const path of DIALOG_SURFACES) {
    const src = readFileSync(path, "utf8");
    assert.doesNotMatch(
      src,
      /addEventListener\(\s*"keydown"/,
      `${path} must not add a competing keydown listener; useModalFocus owns Escape`,
    );
  }
});

test("gallery tablists support roving tabindex and arrow keys", () => {
  const src = readFileSync("ui/src/components/GalleryModal.tsx", "utf8");
  const tablists = src.match(/role="tablist"/g) ?? [];
  const handlers = src.match(/onKeyDown=\{onTablistKeyDown\}/g) ?? [];
  assert.equal(
    handlers.length,
    tablists.length,
    "every role=tablist container needs the arrow-key handler",
  );
  const tabs = src.match(/role="tab"/g) ?? [];
  const roving = src.match(/tabIndex=\{[^}]*\? 0 : -1\}/g) ?? [];
  assert.equal(roving.length, tabs.length, "every role=tab needs a roving tabIndex");
});

test("in-flight progress is exposed as a live region", () => {
  const src = readFileSync("ui/src/components/InFlightList.tsx", "utf8");
  const lists = src.match(/className=\{?[`"]in-flight-list/g) ?? [];
  const live = src.match(/aria-live="polite"/g) ?? [];
  assert.ok(lists.length > 0, "expected in-flight list markup");
  assert.equal(live.length, lists.length, "every in-flight list must be a live region");
  // aria-atomic would re-announce the whole list on each tick; with up to 12 parallel
  // jobs that floods the screen reader.
  assert.doesNotMatch(src, /aria-atomic="true"/);
});

test("gallery session loading is announced", () => {
  const src = readFileSync("ui/src/components/GalleryModal.tsx", "utf8");
  assert.match(src, /className="gallery__empty" role="status" aria-live="polite"/);
});
