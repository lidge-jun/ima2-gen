import { lazy, Suspense, useEffect, useState, useCallback } from "react";
import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";
import { PromptLibraryRow } from "./PromptLibraryRow";
import { SavePromptPopover } from "./SavePromptPopover";

type PromptLibraryPanelProps = {
  variant?: "overlay" | "embedded";
};

const LazyPromptImportDialog = lazy(() =>
  import("./PromptImportDialog").then((module) => ({ default: module.PromptImportDialog })),
);

export function PromptLibraryPanel({ variant = "overlay" }: PromptLibraryPanelProps) {
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

  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

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

  const content = (
      <div className="prompt-library-panel__drawer">
        <div className="prompt-library-panel__header">
          <h3>{t("promptLibrary.title")}</h3>
          <div className="prompt-library-panel__actions">
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
              onClick={() => setImportOpen(true)}
              title={t("promptLibrary.importFiles")}
              aria-label={t("promptLibrary.importFiles")}
            >
              {t("promptLibrary.import")}
            </button>
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
          <button
            type="button"
            className={`prompt-library-panel__filter-toggle${favoritesOnly ? " active" : ""}`}
            aria-pressed={favoritesOnly}
            title={t("promptLibrary.favorites")}
            onClick={() => setFavoritesOnly((v) => !v)}
          >
            <span aria-hidden="true">★</span>
            <span>{t("promptLibrary.favorites")}</span>
          </button>
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

        {importOpen ? (
          <Suspense fallback={null}>
            <LazyPromptImportDialog
              open={importOpen}
              onClose={() => setImportOpen(false)}
              onImported={load}
            />
          </Suspense>
        ) : null}
      </div>
  );

  return (
    <div className={`prompt-library-panel prompt-library-panel--${variant}`}>
      {variant === "overlay" ? (
        <div className="prompt-library-panel__backdrop" onClick={toggle} />
      ) : null}
      {content}
    </div>
  );
}
