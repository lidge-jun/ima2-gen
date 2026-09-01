import { useRef, type ClipboardEvent } from "react";
import { usePromptBuilderStore } from "../../store/promptBuilderStore";
import { useAppStore } from "../../store/useAppStore";
import { useI18n } from "../../i18n";
import { PromptBuilderAttachmentTray } from "./PromptBuilderAttachments";

export function PromptBuilderComposer() {
  const draft = usePromptBuilderStore((s) => s.draft);
  const setDraft = usePromptBuilderStore((s) => s.setDraft);
  const loading = usePromptBuilderStore((s) => s.loading);
  const configLoaded = usePromptBuilderStore((s) => s.configLoaded);
  const addAttachments = usePromptBuilderStore((s) => s.addAttachments);
  const sendMessage = usePromptBuilderStore((s) => s.sendMessage);
  const messages = usePromptBuilderStore((s) => s.messages);
  const clearMessages = usePromptBuilderStore((s) => s.clearMessages);
  const attachments = usePromptBuilderStore((s) => s.attachments);

  const prompt = useAppStore((s) => s.prompt);
  const insertedPrompts = useAppStore((s) => s.insertedPrompts);
  const quality = useAppStore((s) => s.quality);
  const getResolvedSize = useAppStore((s) => s.getResolvedSize);
  const currentImage = useAppStore((s) => s.currentImage);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();

  const submit = () => {
    if ((!draft.trim() && attachments.length === 0) || loading || !configLoaded) return;
    void sendMessage({
      currentPrompt: prompt,
      insertedPrompts: insertedPrompts.map((p) => ({ name: p.name, text: p.text })),
      settings: { quality, size: getResolvedSize() },
      currentResultPrompt: currentImage?.prompt ?? null,
    });
  };

  const handleFiles = (files: File[]) => {
    if (files.length === 0) return;
    void addAttachments(files);
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData?.files ?? []);
    if (files.length === 0) return;
    event.preventDefault();
    handleFiles(files);
  };

  return (
    <div className="prompt-builder__composer">
      <PromptBuilderAttachmentTray />
      <textarea
        value={draft}
        placeholder={t("promptBuilder.placeholder")}
        onChange={(e) => setDraft(e.target.value)}
        onPaste={handlePaste}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          handleFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <div className="prompt-builder__composer-actions">
        <button
          type="button"
          className="prompt-builder__attach"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          aria-label={t("promptBuilder.attach")}
          title={t("promptBuilder.attach")}
        >
          +
        </button>
        <button
          type="button"
          className="prompt-builder__clear"
          onClick={clearMessages}
          disabled={messages.length === 0 || loading}
        >
          {t("promptBuilder.clear")}
        </button>
        <button
          type="button"
          className="prompt-builder__send"
          onClick={submit}
          disabled={(!draft.trim() && attachments.length === 0) || loading || !configLoaded}
        >
          {loading ? t("promptBuilder.sending") : t("promptBuilder.send")}
        </button>
      </div>
    </div>
  );
}
