import { useMemo, useState } from "react";
import { useI18n } from "../../i18n";
import { useAppStore } from "../../store/useAppStore";
import type { AssetFolder } from "../../store/storeTypes";
import { EditIcon } from "../controls";

type FolderRowProps = { folder: AssetFolder; depth: number };

function FolderRow({ folder, depth }: FolderRowProps) {
  const { t } = useI18n();
  const activeId = useAppStore((s) => s.assetsFilters.folderId);
  const setFilters = useAppStore((s) => s.setAssetsFilters);
  const renameFolder = useAppStore((s) => s.renameAssetFolder);
  const deleteFolder = useAppStore((s) => s.deleteAssetFolder);
  const showToast = useAppStore((s) => s.showToast);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const isActive = activeId === folder.id;

  async function commitRename() {
    const next = name.trim();
    if (!next || next === folder.name) { setName(folder.name); setEditing(false); return; }
    if (!await renameFolder(folder.id, next)) showToast(t("assets.actionFailed"), true);
    setEditing(false);
  }

  async function handleDelete() {
    if (!deleteArmed) { setDeleteArmed(true); return; }
    if (!await deleteFolder(folder.id)) showToast(t("assets.actionFailed"), true);
    setDeleteArmed(false);
  }

  return (
    <div className="assets-folder-row" style={{ "--folder-depth": depth } as React.CSSProperties}>
      {editing ? (
        <input className="assets-folder-input" value={name} autoFocus aria-label={t("assets.renameFolder")}
          onChange={(event) => setName(event.target.value)} onBlur={() => void commitRename()}
          onKeyDown={(event) => {
            if (event.key === "Enter") void commitRename();
            if (event.key === "Escape") { setName(folder.name); setEditing(false); }
          }} />
      ) : (
        <button type="button" className={`assets-folder-row__name${isActive ? " is-active" : ""}`}
          aria-current={isActive ? "page" : undefined}
          onClick={() => setFilters({ folderId: folder.id, kind: null })}>{folder.name}</button>
      )}
      {!editing && <span className="assets-folder-row__actions">
        <button type="button" aria-label={t("assets.renameFolder")} onClick={() => setEditing(true)}><EditIcon /></button>
        <button type="button" aria-label={deleteArmed ? t("assets.confirmDelete") : t("assets.deleteFolder")}
          className={deleteArmed ? "is-danger is-armed" : ""} onClick={() => void handleDelete()}>{deleteArmed ? t("assets.confirmDelete") : "×"}</button>
      </span>}
    </div>
  );
}

export function AssetsFolderTree() {
  const { t } = useI18n();
  const folders = useAppStore((s) => s.assetsFolders);
  const activeId = useAppStore((s) => s.assetsFilters.folderId);
  const activeKind = useAppStore((s) => s.assetsFilters.kind);
  const setFilters = useAppStore((s) => s.setAssetsFilters);
  const createFolder = useAppStore((s) => s.createAssetFolder);
  const showToast = useAppStore((s) => s.showToast);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const allActive = activeId === null && activeKind !== "element";
  const elementActive = activeId === null && activeKind === "element";
  const rows = useMemo(() => {
    const result: Array<{ folder: AssetFolder; depth: number }> = [];
    const visit = (parentId: string | null, depth: number) => folders.filter((f) => f.parentId === parentId)
      .forEach((folder) => { result.push({ folder, depth }); visit(folder.id, depth + 1); });
    visit(null, 0);
    return result;
  }, [folders]);

  async function commitCreate() {
    const next = name.trim();
    if (!next) { setCreating(false); return; }
    if (!await createFolder(next, activeId)) showToast(t("assets.actionFailed"), true);
    setName(""); setCreating(false);
  }

  return <aside className="assets-folders" aria-label={t("assets.rootFolder")}>
    <div className="assets-folders__heading"><span>{t("assets.rootFolder")}</span>
      <button type="button" aria-label={t("assets.newFolder")} onClick={() => setCreating(true)}>+</button></div>
    <div className="assets-folders__rows">
      <button type="button" className={`assets-folder-all${allActive ? " is-active" : ""}`}
        aria-current={allActive ? "page" : undefined}
        onClick={() => setFilters({ folderId: null, kind: null })}>{t("assets.allAssets")}</button>
      {/* Pinned entry for persistent @-mentionable elements (characters, products,
          styles, scenes). Not a folder — a kind-scoped view across all folders. */}
      <button type="button" className={`assets-folder-all assets-folder-elements${elementActive ? " is-active" : ""}`}
        aria-current={elementActive ? "page" : undefined}
        onClick={() => setFilters({ folderId: null, kind: "element" })}>
        <span className="assets-folder-elements__glyph" aria-hidden="true">@</span>
        {t("assets.elementLibrary")}
      </button>
      {rows.map(({ folder, depth }) => <FolderRow key={folder.id} folder={folder} depth={depth} />)}
      {creating && <input className="assets-folder-input assets-folder-input--new" value={name} autoFocus
        aria-label={t("assets.newFolder")} placeholder={t("assets.newFolder")} onChange={(e) => setName(e.target.value)}
        onBlur={() => { if (!name.trim()) setCreating(false); }} onKeyDown={(e) => {
          if (e.key === "Enter") void commitCreate();
          if (e.key === "Escape") { setName(""); setCreating(false); }
        }} />}
    </div>
  </aside>;
}
