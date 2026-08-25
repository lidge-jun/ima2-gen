import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";

/**
 * NovelAI's undesired-content prompt.
 *
 * Lives in the composer rather than the settings panel because it is prompt
 * content, not a preference: it changes per generation and rides in the same
 * history provenance as the positive prompt.
 *
 * Self-gates on the provider so both composers can mount it unconditionally.
 * The typed value stays in the store when the user switches lanes — losing it
 * on a provider toggle would be worse than showing a stale field.
 *
 * Mounted outside the classic composer's prompt stack: inside it the field
 * would inherit the @-mention keydown handling, which is wrong for a tag list.
 */
export function NegativePromptField({ variant }: { variant: "classic" | "home" }) {
  const provider = useAppStore((s) => s.provider);
  const value = useAppStore((s) => s.negativePrompt);
  const setValue = useAppStore((s) => s.setNegativePrompt);
  const { t } = useI18n();
  const [focused, setFocused] = useState(false);

  if (provider !== "nai") return null;

  const expanded = focused || value.length > 0;
  const id = `negative-prompt-${variant}`;

  return (
    <div className={`negative-prompt negative-prompt--${variant}`}>
      <label className="negative-prompt__label" htmlFor={id}>
        {t("nai.negativePrompt.label")}
      </label>
      <textarea
        id={id}
        className={`negative-prompt__textarea${expanded ? " negative-prompt__textarea--expanded" : ""}`}
        rows={expanded ? 3 : 1}
        value={value}
        placeholder={t("nai.negativePrompt.placeholder")}
        onChange={(event) => setValue(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // No submit-on-Enter: the positive prompt owns that shortcut, and two
        // different Enter semantics in adjacent fields is a trap.
      />
      {expanded ? (
        <p className="negative-prompt__hint">{t("nai.negativePrompt.hint")}</p>
      ) : null}
    </div>
  );
}
