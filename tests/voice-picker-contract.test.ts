import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildIma2Capabilities } from "../lib/capabilities.js";
import { MAX_REFERENCE_AUDIOS } from "../lib/imageModels.js";

// devlog/_plan/260908_xai_imagine_spec_resync/030_wp35_gui_inputs.md
//
// reference_audios existed on the route and in the CLI but had no GUI at all, so the
// only way to give a subject a voice was the command line.

function source(path: string): string {
  return readFileSync(new URL("../" + path, import.meta.url), "utf8");
}

test("the roster comes from the server, not from a list baked into the UI", () => {
  // xAI owns the voice roster and its 400 names every voice it accepts. A copy in the
  // component would drift the first time a voice is added, and the drift would be
  // invisible: an unknown id fails only at generate time.
  const picker = source("ui/src/components/VoicePicker.tsx");
  assert.match(picker, /getCapabilities\(\)/);
  assert.match(picker, /referenceAudio\?\.knownPresets/);
  const advertised = buildIma2Capabilities({ packageVersion: "0.0.0-test", source: "server" })
    .valid.videoModels.referenceAudio.knownPresets;
  for (const voice of advertised) {
    assert.doesNotMatch(picker, new RegExp('"' + voice + '"'), "voice " + voice + " is hardcoded in the picker");
  }
});

test("the picker enforces the same ceiling the server does", () => {
  assert.equal(MAX_REFERENCE_AUDIOS, 3);
  const store = source("ui/src/store/useAppStore.ts");
  assert.match(store, /current\.length >= 3 \? current/, "the store must refuse a fourth voice");
  assert.match(source("ui/src/components/VoicePicker.tsx"), /const MAX_VOICES = 3;/);
});

test("voices reach the route through the field it already reads", () => {
  // routes/video.ts has parsed referenceAudios since 260820; this is a client for an
  // existing contract, not a new one.
  const impl = source("ui/src/store/storeVideoImpl.ts");
  assert.match(impl, /referenceAudios: get\(\)\.videoReferenceVoices/);
  // Absent rather than empty: an empty array would advertise reference-to-video for a
  // request with nothing to reference.
  assert.match(impl, /videoReferenceVoices\.length > 0 \?/);
});

test("the base model disables the picker with a reason instead of hiding it", () => {
  // Hiding reads as "this product cannot do voices"; a disabled control with a reason
  // tells the user which model to switch to. Same pattern as the 1080p chip.
  const picker = source("ui/src/components/VoicePicker.tsx");
  assert.match(picker, /GROK_VIDEO_MODEL_15/);
  assert.match(picker, /video\.voiceNeeds15/);
  assert.match(picker, /disabled=\{!supported/);
});

test("a selected voice shows the AUDIO index the prompt must use", () => {
  // The prompt refers to voices as <AUDIO_0> upward and the order is the contract, so
  // the chip has to show which index a voice took.
  assert.match(source("ui/src/components/VoicePicker.tsx"), /AUDIO_\${selected\.indexOf\(voice\)}/);
});

test("custom voice ids stay reachable", () => {
  // presetsAreAuthoritative is false: /v1/custom-voices ids are accepted too and cannot
  // be enumerated from here.
  const caps = buildIma2Capabilities({ packageVersion: "0.0.0-test", source: "server" })
    .valid.videoModels.referenceAudio;
  assert.equal(caps.presetsAreAuthoritative, false);
  assert.equal(caps.customVoiceApi, "/v1/custom-voices");
  assert.match(source("ui/src/components/VoicePicker.tsx"), /voiceCustomPlaceholder/);
});

test("every voice-picker string exists in all four locales", () => {
  const keys = ["voiceSection", "voiceLimit", "voiceNeeds15", "voiceCustomPlaceholder"];
  for (const locale of ["ko", "en", "zh-Hans", "zh-Hant"]) {
    const bundle = JSON.parse(source("ui/src/i18n/" + locale + ".json"));
    for (const key of keys) {
      assert.ok(bundle.video?.[key], locale + " is missing video." + key);
    }
  }
});

