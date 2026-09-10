import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// devlog/_plan/260908_xai_imagine_spec_resync/030_wp35_gui_inputs.md
//
// /api/video/edit is real video-to-video and has existed since 260716 with no GUI
// caller, so editing a clip meant dropping to the CLI. These pin the client that closes
// that gap, and the model constraint that makes it work at all.

function source(path: string): string {
  return readFileSync(new URL("../" + path, import.meta.url), "utf8");
}

test("the edit client posts to the route that already exists", () => {
  const client = source("ui/src/lib/videoEditRequest.ts");
  assert.match(client, /"\/api\/video\/edit"/);
  // The route answers synchronously after polling upstream rather than over SSE, so the
  // client must not expect a 202 acceptance envelope the way the extend path does.
  assert.doesNotMatch(client, /202/);
});

test("editing is pinned to the base model", () => {
  // grok-imagine-video-1.5 answers 400 "Video editing is not supported for this model."
  // Passing the source clip's own model would send exactly the one that fails, since
  // 1.5 is the generation default.
  assert.match(source("ui/src/components/ResultActions.tsx"), /model: "grok-imagine-video"/);
});

test("the route still refuses 1.5 for edits and extensions", () => {
  // The client's assumption is only safe while the server keeps enforcing it.
  const route = source("routes/videoExtended.ts");
  assert.match(route, /validateEditModel/);
});

test("the edit action is offered only on video results", () => {
  const component = source("ui/src/components/ResultActions.tsx");
  const editButton = component.indexOf("onClick={editVideo}");
  assert.ok(editButton > 0, "the edit button must exist");
  // It lives inside the canExtend block, which is `isVideo && filename`.
  const guard = component.indexOf("{canExtend && (");
  assert.ok(guard > 0 && guard < editButton, "the edit button must sit behind the video guard");
});

test("a long edit can be cancelled", () => {
  // Upstream polling runs for minutes; a button with no way out is a hang.
  const component = source("ui/src/components/ResultActions.tsx");
  assert.match(component, /const cancelEdit = \(\) => editAbortRef\.current\?\.abort\(\)/);
  assert.match(component, /onClick=\{cancelEdit\}/);
});

test("every edit string exists in all four locales", () => {
  for (const locale of ["ko", "en", "zh-Hans", "zh-Hant"]) {
    const bundle = JSON.parse(source("ui/src/i18n/" + locale + ".json"));
    for (const key of ["editVideo", "editVideoTitle", "editVideoPrompt"]) {
      assert.ok(bundle.result?.[key], locale + " is missing result." + key);
    }
  }
});

