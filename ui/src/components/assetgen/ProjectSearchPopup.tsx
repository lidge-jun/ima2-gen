import { useMemo, useRef, useState } from "react";
import { useI18n } from "../../i18n";
import { useModalFocus } from "../../hooks/useModalFocus";
import { useAppStore } from "../../store/useAppStore";

type Props = { onClose: () => void; onSelect: (id: string | null) => void };

export function ProjectSearchPopup({ onClose, onSelect }: Props) {
  const { t } = useI18n();
  const folders = useAppStore((s) => s.assetsFolders);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useModalFocus<HTMLDivElement>(true, onClose);

  const results = useMemo(() => {
    const roots = folders.filter((f) => f.parentId === null);
    const q = query.trim().toLowerCase();
    return q ? roots.filter((f) => f.name.toLowerCase().includes(q)) : roots;
  }, [folders, query]);

  return (
    <div className="assetgen-popup-backdrop" onClick={onClose}>
      <div ref={dialogRef}
        className="assetgen-popup"
        role="dialog"
        aria-modal="true"
        aria-label={t("project.search")}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder={t("project.searchPlaceholder")}
          aria-label={t("project.search")}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul role="listbox" aria-label={t("project.select")}>
          <li>
            <button type="button" onClick={() => { onSelect(null); onClose(); }}>
              {t("project.unassigned")}
            </button>
          </li>
          {results.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => { onSelect(f.id); onClose(); }}>
                {f.name}
              </button>
            </li>
          ))}
          {results.length === 0 && query.trim() ? (
            <li className="assetgen-popup__empty">{t("project.searchEmpty")}</li>
          ) : null}
        </ul>
        <button type="button" className="assetgen-popup__close" onClick={onClose}>
          {t("project.close")}
        </button>
      </div>
    </div>
  );
}
