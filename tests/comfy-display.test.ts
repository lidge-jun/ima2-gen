import assert from "node:assert/strict";
import test from "node:test";
import { withLaneCatalog } from "./_laneCatalogFixture";
import type { LaneCatalogSnapshot } from "../ui/src/lib/laneCatalog";
import type { ComfyDisplay, ComfySelection } from "../ui/src/lib/comfyDisplay";
import type { ComfyLaneModel, LaneStatus } from "../ui/src/lib/api-comfy";

const image = { id: "shared", label: "Cedar image" };
const video = { id: "shared", label: "Cedar video" };
const snapshot = (status: LaneStatus = "ready", images: ComfyLaneModel[] = [image], videos: ComfyLaneModel[] = [video]): LaneCatalogSnapshot => ({
  phase: "ready", catalog: { comfy: { status, models: { image: images, video: videos } } }, observedAt: 123, error: null,
});

test("lane-only availability and media-specific selection remain independent", async () => {
  await withLaneCatalog(async ({ api }) => {
    const cases: Array<[ComfySelection | null, ComfyDisplay]> = [
      [null, { code: "choose", laneAvailable: true, selected: null, selectedAvailable: false, imageCount: 1, videoCount: 1 }],
      [{}, { code: "choose", laneAvailable: true, selected: null, selectedAvailable: false, imageCount: 1, videoCount: 1 }],
      [{ comfyWorkflow: undefined, comfyVideoWorkflow: undefined }, { code: "choose", laneAvailable: true, selected: null, selectedAvailable: false, imageCount: 1, videoCount: 1 }],
      [{ comfyWorkflow: null, comfyVideoWorkflow: null }, { code: "choose", laneAvailable: true, selected: null, selectedAvailable: false, imageCount: 1, videoCount: 1 }],
      [{ comfyWorkflow: "shared" }, { code: "ready", laneAvailable: true, selected: { id: "shared", kind: "image", label: "Cedar image" }, selectedAvailable: true, imageCount: 1, videoCount: 1 }],
      [{ comfyWorkflow: "shared", comfyVideoWorkflow: "shared" }, { code: "ready", laneAvailable: true, selected: { id: "shared", kind: "video", label: "Cedar video" }, selectedAvailable: true, imageCount: 1, videoCount: 1 }],
    ];
    for (const [selection, expected] of cases) assert.deepEqual(api.deriveComfyDisplay(snapshot(), selection), expected);
  });
});

test("loading, error and unavailable states cannot lend stale green availability", async () => {
  await withLaneCatalog(async ({ api }) => {
    for (const phase of ["idle", "loading", "error"] as const) {
      const state = { ...snapshot(), phase, error: phase === "error" ? "request" as const : null };
      assert.deepEqual(api.deriveComfyDisplay(state, { comfyWorkflow: "shared" }), {
        code: phase === "error" ? "error" : "loading", laneAvailable: false, selectedAvailable: false,
        selected: { id: "shared", kind: "image", label: "Cedar image" }, imageCount: 1, videoCount: 1,
      });
    }
    for (const catalog of [{}, snapshot("locked").catalog, snapshot("key-missing").catalog]) {
      const result = api.deriveComfyDisplay({ ...snapshot(), catalog }, null);
      assert.equal(result.code, "unavailable"); assert.equal(result.laneAvailable, false);
    }
  });
});

test("empty and missing selection precedence survive disconnected and opposite-kind catalogs", async () => {
  await withLaneCatalog(async ({ api }) => {
    for (const status of ["ready", "disconnected"] as const) {
      assert.deepEqual(api.deriveComfyDisplay(snapshot(status, [], []), null), {
        code: "empty", laneAvailable: false, selectedAvailable: false, selected: null, imageCount: 0, videoCount: 0,
      });
      assert.deepEqual(api.deriveComfyDisplay(snapshot(status, [], []), { comfyWorkflow: "deleted" }), {
        code: "selected-missing", laneAvailable: false, selectedAvailable: false,
        selected: { id: "deleted", kind: "image", label: "deleted" }, imageCount: 0, videoCount: 0,
      });
    }
    assert.deepEqual(api.deriveComfyDisplay(snapshot("ready", [], [video]), { comfyWorkflow: "shared" }), {
      code: "selected-missing", laneAvailable: true, selectedAvailable: false,
      selected: { id: "shared", kind: "image", label: "shared" }, imageCount: 0, videoCount: 1,
    });
    assert.equal(api.deriveComfyDisplay(snapshot("disconnected"), { comfyWorkflow: "shared" }).code, "disconnected");
  });
});

test("mixed origins, locks and video-only eligibility do not certify the selected workflow", async () => {
  await withLaneCatalog(async ({ api }) => {
    for (const kind of ["image", "video"] as const) {
      const offline = { id: "offline", label: "Offline", description: "http://fixture (offline)" };
      const selection = kind === "image" ? { comfyWorkflow: "offline" } : { comfyVideoWorkflow: "offline" };
      const state = snapshot("ready", kind === "image" ? [image, offline] : [image], kind === "video" ? [video, offline] : [video]);
      const result = api.deriveComfyDisplay(state, selection);
      assert.equal(result.laneAvailable, true); assert.equal(result.selectedAvailable, false); assert.equal(result.code, "selected-offline");
    }
    const locked = { ...image, executable: false };
    assert.equal(api.deriveComfyDisplay(snapshot("ready", [locked], []), { comfyWorkflow: "shared" }).code, "selected-locked");
    assert.equal(api.deriveComfyDisplay(snapshot("ready", [locked], []), null).code, "unavailable");
    assert.deepEqual(api.deriveComfyDisplay(snapshot("ready", [], [video]), { comfyVideoWorkflow: "shared" }), {
      code: "ready", laneAvailable: true, selectedAvailable: true,
      selected: { id: "shared", kind: "video", label: "Cedar video" }, imageCount: 0, videoCount: 1,
    });
    assert.equal(api.isComfyModelAvailable({ ...image, description: "offline is a name" }), true);
    assert.equal(api.isComfyModelAvailable({ ...image, description: "origin (offline)" }), false);
  });
});

test("fixed message mapping distinguishes app access and stale observation without raw text", async () => {
  await withLaneCatalog(async ({ api }) => {
    for (const [phase, catalog, error, expected] of [
      ["idle", null, null, "comfy.display.loading"],
      ["loading", snapshot().catalog, null, "comfy.display.refreshing"],
      ["error", snapshot().catalog, "app-auth", "comfy.display.appAccessRequired"],
      ["error", snapshot().catalog, "invalid", "comfy.display.loadFailed"],
      ["error", snapshot().catalog, "request", "comfy.display.loadFailed"],
    ] as const) {
      const state: LaneCatalogSnapshot = { phase, catalog, error, observedAt: null };
      assert.equal(api.comfyDisplayMessageKey(api.deriveComfyDisplay(state, null), state), expected);
    }
    assert.equal(api.comfyDisplayMessageKey(api.deriveComfyDisplay(snapshot(), { comfyWorkflow: "shared" }), snapshot()), "comfy.display.available");
    assert.equal(api.comfyDisplayMessageKey(api.deriveComfyDisplay(snapshot("ready", [], []), null), snapshot()), "comfy.display.empty");
  });
});
