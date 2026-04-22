import { useAppStore } from "../store/useAppStore";

export function PromptInput() {
  const prompt = useAppStore((s) => s.prompt);
  const setPrompt = useAppStore((s) => s.setPrompt);
  const mode = useAppStore((s) => s.mode);
  const generate = useAppStore((s) => s.generate);

  const placeholder =
    mode === "i2i"
      ? "Describe the edit you want to make..."
      : "Describe the image you want to generate...";

  return (
    <>
      <div className="section-title">Prompt</div>
      <textarea
        className="prompt-area"
        value={prompt}
        placeholder={placeholder}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void generate();
          }
        }}
      />
    </>
  );
}
