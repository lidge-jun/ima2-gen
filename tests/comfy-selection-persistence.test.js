import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

describe("comfy selection persistence", () => {
  it("persists the comfy video workflow across a reload", () => {
    // Hard QA in a real browser found the provider surviving a reload while the
    // chosen workflow did not, which reads to a user exactly like the original
    // "it will not select" complaint.
    const persistence = read("ui/src/store/storePersistence.ts");
    assert.match(persistence, /out\.comfyVideoWorkflow = parsed\.comfyVideoWorkflow/);

    const settings = read("ui/src/store/storeSettingsImpl.ts");
    assert.match(settings, /saveGenerationDefaultsPatch\(\{ comfyVideoWorkflow: workflowId \}\)/);

    const store = read("ui/src/store/useAppStore.ts");
    assert.match(store, /comfyVideoWorkflow: storedGenerationDefaults\.comfyVideoWorkflow/);
  });

  it("does not discard the workflow when comfy is re-selected", () => {
    // setProviderImpl cleared both comfy fields unconditionally, so hydrating a
    // restored selection wiped it immediately. Clearing belongs to arriving
    // from another lane, not to re-entering the one already selected.
    const settings = read("ui/src/store/storeSettingsImpl.ts");
    assert.match(settings, /if \(get\(\)\.provider === "comfy"\) set\(\{ provider \}\);/);
  });
});
