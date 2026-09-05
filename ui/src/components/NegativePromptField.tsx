import { useRef } from "react";
import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";

type NegativePromptFieldProps = {
  variant: "classic" | "home";
  onSubmit: () => void;
};

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
 * Receives only the shared submit callback. Mention parsing remains owned by
 * the positive field, so an @ typed here stays literal text.
 */
export function NegativePromptField({ variant, onSubmit }: NegativePromptFieldProps) {
  const provider = useAppStore((s) => s.provider);
  const value = useAppStore((s) => s.negativePrompt);
  const setValue = useAppStore((s) => s.setNegativePrompt);
  const composingRef = useRef(false);
  const { t } = useI18n();

  if (provider !== "nai") return null;

  const id = `negative-prompt-${variant}`;
  const hintId = `${id}-hint`;

  return (
    <div className={`negative-prompt negative-prompt--${variant}`}>
      <label className="negative-prompt__label" htmlFor={id}>
        {t("nai.negativePrompt.label")}
      </label>
      <textarea
        id={id}
        className={`negative-prompt__textarea${variant === "home" ? " home-prompt__textarea" : ""}`}
        rows={5}
        value={value}
        placeholder={t("nai.negativePrompt.placeholder")}
        aria-describedby={hintId}
        onCompositionStart={() => { composingRef.current = true; }}
        onCompositionEnd={() => { composingRef.current = false; }}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey)) return;
          if (event.defaultPrevented || composingRef.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
          event.preventDefault();
          onSubmit();
        }}
      />
      <p id={hintId} className="negative-prompt__hint">
        {t("nai.negativePrompt.hint", { count: value.length })}
      </p>
    </div>
  );
}
