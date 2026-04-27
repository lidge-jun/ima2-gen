import { useEffect, useState, useCallback, useRef, type ChangeEvent } from "react";
import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";
import { PromptLibraryRow } from "./PromptLibraryRow";
import { SavePromptPopover } from "./SavePromptPopover";

export function PromptLibraryPanel() {
  const { t } = useI18n();
  const open = useAppStore((s) => s.promptLibraryOpen);
  const toggle = useAppStore((s) => s.togglePromptLibrary);
  const library = useAppStore((s) => s.promptLibrary);
  const loading = useAppStore((s) => s.promptLibraryLoading);
  const load = useAppStore((s) => s.loadPromptLibrary);
  const deletePrompt = useAppStore((s) => s.deletePromptFromLibrary);
  const toggleFavorite = useAppStore((s) => s.togglePromptFavorite);
  const setPrompt = useAppStore((s) => s.setPrompt);
  const insertPromptToComposer = useAppStore((s) => s.insertPromptToComposer);
  const clearInsertedPrompts = useAppStore((s) => s.clearInsertedPrompts);
  const showToast = useAppStore((s) => s.showToast);
  const importPrompts = useAppStore((s) => s.importPromptsToLibrary);

  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (dragCounterRef.current > 0) setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setDragActive(false);

      const files = Array.from(e.dataTransfer.files).filter((f) =>
        /\.(txt|md)$/i.test(f.name),
      );
      if (files.length > 0) {
        void importPrompts(files);
      }
    },
    [importPrompts],
  );

  const handleFileImport = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) {
        void importPrompts(files);
      }
      e.target.value = "";
    },
    [importPrompts],
  );

  const insertPrompt = useCallback(
    (prompt: { id: string; name: string; text: string }) => {
      insertPromptToComposer({
        id: prompt.id,
        name: prompt.name || t("promptLibrary.untitled"),
        text: prompt.text,
      });
      showToast(t("promptLibrary.inserted"));
      toggle();
    },
    [insertPromptToComposer, showToast, t, toggle],
  );

  if (!open) return null;

  const filtered = library.prompts.filter((p) => {
    if (favoritesOnly && !p.isFavorite) return false;
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      p.text.toLowerCase().includes(term) ||
      p.tags.some((tag) => tag.toLowerCase().includes(term))
    );
  });

  return (
    <div
      className="prompt-library-panel"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="prompt-library-panel__backdrop" onClick={toggle} />
      <div className="prompt-library-panel__drawer">
        <div className="prompt-library-panel__header">
          <h3>{t("promptLibrary.title")}</h3>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              className="prompt-library-panel__add"
              onClick={() => setAddOpen((v) => !v)}
              title={t("promptLibrary.addNew")}
              aria-label={t("promptLibrary.addNew")}
            >
              +
            </button>
            <button
              className="prompt-library-panel__import"
              onClick={() => fileInputRef.current?.click()}
              title={t("promptLibrary.importFiles")}
              aria-label={t("promptLibrary.importFiles")}
            >
              {t("promptLibrary.import")}
            </button>
            <input
              ref={fileInputRef}
              className="prompt-library-panel__file-input"
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              multiple
              onChange={handleFileImport}
            />
            <button onClick={toggle} aria-label={t("common.close")}>×</button>
          </div>
          {addOpen && (
            <SavePromptPopover
              text=""
              onClose={() => setAddOpen(false)}
            />
          )}
        </div>

        <div className="prompt-library-panel__search">
          <input
            type="text"
            placeholder={t("promptLibrary.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="prompt-library-panel__filter">
            <input
              type="checkbox"
              checked={favoritesOnly}
              onChange={(e) => setFavoritesOnly(e.target.checked)}
            />
            <span>★ {t("promptLibrary.favorites")}</span>
          </label>
        </div>

        {loading ? (
          <div className="prompt-library-panel__loading">{t("common.loading")}</div>
        ) : (
          <div className="prompt-library-panel__list">
            {filtered.length === 0 ? (
              <div className="prompt-library-panel__empty">{t("promptLibrary.empty")}</div>
            ) : (
              filtered.map((prompt) => (
                <PromptLibraryRow
                  key={prompt.id}
                  prompt={prompt}
                  onLoad={() => {
                    clearInsertedPrompts();
                    setPrompt(prompt.text);
                    toggle();
                  }}
                  onInsert={() => insertPrompt(prompt)}
                  onDelete={() => deletePrompt(prompt.id)}
                  onToggleFavorite={() => toggleFavorite(prompt.id)}
                />
              ))
            )}
          </div>
        )}

        {dragActive && (
          <div className="prompt-library-panel__drop-overlay">
            <div className="prompt-library-panel__drop-message">
              {t("promptLibrary.dropImport")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
