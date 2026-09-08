// Preset-voice picker for reference-to-video.
//
// The roster is read from /api/capabilities rather than hardcoded: xAI owns it, its 400
// names every voice it will take, and a list baked into this file would drift the moment
// a voice is added. presetsAreAuthoritative is false there for the same reason, which is
// why a custom id can also be typed in — those come from /v1/custom-voices and cannot be
// enumerated from here at all.
//
// devlog/_plan/260908_xai_imagine_spec_resync/030_wp35_gui_inputs.md
import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";
import { getCapabilities } from "../lib/api";
import { GROK_VIDEO_MODEL_15, normalizeVideoModelValue } from "../lib/imageModels";

const MAX_VOICES = 3;

export function VoicePicker() {
  const { t } = useI18n();
  const videoModelSelected = useAppStore((s) => s.videoModelSelected);
  const selected = useAppStore((s) => s.videoReferenceVoices);
  const toggle = useAppStore((s) => s.toggleVideoReferenceVoice);
  const [presets, setPresets] = useState<string[]>([]);
  const [custom, setCustom] = useState("");

  useEffect(() => {
    let alive = true;
    getCapabilities()
      .then((caps) => {
        if (!alive) return;
        setPresets(caps.valid?.videoModels?.referenceAudio?.knownPresets ?? []);
      })
      .catch(() => { /* the picker simply stays empty; the CLI path still works */ });
    return () => { alive = false; };
  }, []);

  // grok-imagine-video answers 400 "reference_audios is not supported for this model."
  // Disabled rather than hidden: hiding it reads as "this product cannot do voices",
  // while a disabled control with a reason tells the user which model to pick.
  const supported = normalizeVideoModelValue(videoModelSelected) === GROK_VIDEO_MODEL_15;
  const full = selected.length >= MAX_VOICES;

  const addCustom = () => {
    const id = custom.trim();
    if (!id || full || selected.includes(id)) return;
    toggle(id);
    setCustom("");
  };

  if (presets.length === 0 && selected.length === 0) return null;

  return (
    <div className="option-group">
      <div className="section-title">{t("video.voiceSection")}</div>
      <div className="composer__hint">
        {supported ? t("video.voiceLimit", { max: MAX_VOICES }) : t("video.voiceNeeds15")}
      </div>
      <div className="option-row" role="group" aria-label={t("video.voiceSection")}>
        {presets.map((voice) => {
          const active = selected.includes(voice);
          return (
            <button
              key={voice}
              type="button"
              className={`option-btn${active ? " active" : ""}`}
              aria-pressed={active}
              disabled={!supported || (!active && full)}
              onClick={() => toggle(voice)}
            >
              {voice}
              {active ? (
                // The order is the contract: the prompt refers to voices as <AUDIO_0>
                // upward, so the chip shows which index this voice took.
                <>
                  <br />
                  <span className="option-sub">{`<AUDIO_${selected.indexOf(voice)}>`}</span>
                </>
              ) : null}
            </button>
          );
        })}
      </div>
      <input
        type="text"
        className="text-input"
        value={custom}
        disabled={!supported || full}
        placeholder={t("video.voiceCustomPlaceholder")}
        onChange={(e) => setCustom(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
        onBlur={addCustom}
        aria-label={t("video.voiceCustomPlaceholder")}
      />
    </div>
  );
}

