import { useEffect, useRef } from "react";
import { usePromptBuilderStore } from "../../store/promptBuilderStore";
import { useI18n } from "../../i18n";
import { PromptBuilderMessage } from "./PromptBuilderMessage";

export function PromptBuilderMessageList() {
  const messages = usePromptBuilderStore((s) => s.messages);
  const loading = usePromptBuilderStore((s) => s.loading);
  const error = usePromptBuilderStore((s) => s.error);
  const messagesRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, loading]);

  return (
    <div ref={messagesRef} className="prompt-builder__messages">
      {messages.length === 0 && (
        <div className="prompt-builder__empty">{t("promptBuilder.empty")}</div>
      )}
      {messages.map((message) => (
        <PromptBuilderMessage key={message.id} message={message} />
      ))}
      {loading && (
        <div className="prompt-builder__thinking" role="status" aria-live="polite">
          <span className="prompt-builder__thinking-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>{t("promptBuilder.thinking")}</span>
        </div>
      )}
      {error ? (
        <div className="prompt-builder__error" role="alert">{error}</div>
      ) : null}
    </div>
  );
}
