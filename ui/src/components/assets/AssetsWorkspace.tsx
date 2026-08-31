import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../../i18n";
import { useAppStore } from "../../store/useAppStore";
import type { AssetItem } from "../../store/storeTypes";
import type { GenerateItem } from "../../types";
import { clearAllAssets as apiClearAll, getAssetById } from "../../lib/api-assets";
import { assetToPreviewItem } from "../../lib/assetPreview";
import { useIsMobile } from "../../hooks/useIsMobile";
import { EditIcon } from "../controls";
import { Select, type SelectItem } from "../controls/Select";
import { AssetMediaLightbox } from "../assetgen/AssetMediaLightbox";
import { KeyingPanel } from "../assetgen/KeyingPanel";
import { AssetsFolderTree } from "./AssetsFolderTree";
import { AssetsGrid } from "./AssetsGrid";
import { useModalFocus } from "../../hooks/useModalFocus";
import { ElementDetail, type ElementDefinition, type ElementDraft } from "./ElementDetail";

const kinds = ["image", "video", "element", "preset", "template"] as const;
type KindValue = "" | typeof kinds[number];
function useMobileAssetDetailDialog(open: boolean, onClose: () => void) {
  return useModalFocus<HTMLElement>(open, onClose);
}

export function AssetsWorkspace() {
  const { t } = useI18n();
  const assets = useAppStore((s) => s.assets);
  const tags = useAppStore((s) => s.assetsTags);
  const filters = useAppStore((s) => s.assetsFilters);
  const loading = useAppStore((s) => s.assetsLoading);
  const loadError = useAppStore((s) => s.assetsLoadError);
  const loadAssets = useAppStore((s) => s.loadAssets);
  const setUIMode = useAppStore((s) => s.setUIMode);
  const setFilters = useAppStore((s) => s.setAssetsFilters);
  const updateAssetItem = useAppStore((s) => s.updateAssetItem);
  const deleteAssetItem = useAppStore((s) => s.deleteAssetItem);
  const showToast = useAppStore((s) => s.showToast);
  const [query, setQuery] = useState(filters.q);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<GenerateItem | null>(null);
  const [detailAssetOverride, setDetailAssetOverride] = useState<AssetItem | null>(null);
  const isMobile = useIsMobile();
  const keyingTarget = useAppStore((s) => s.keyingTarget);
  const pendingAssetDetailId = useAppStore((s) => s.pendingAssetDetailId);
  useEffect(() => {
    if (!pendingAssetDetailId) return;
    const id = pendingAssetDetailId;
    useAppStore.setState({ pendingAssetDetailId: null });
    // Seed/clear the override FIRST: an existing filtered target can still
    // vanish from the reset page, and a stale override from a prior request
    // must never outlive a failed fetch (Socrates round 4).
    const existing = useAppStore.getState().assets.find((asset) => asset.id === id) ?? null;
    setDetailAssetOverride(existing);
    // The target may be outside the current filter/page — reset filters so it
    // becomes visible (local query too, or the debounced effect restores the
    // old search), then upsert it directly when the list lacks it. The
    // override keeps the detail mounted even if a reset load replaces the
    // upserted entry (Socrates round 3).
    setFilters({ kind: null, folderId: null, tag: null, q: "" });
    setQuery("");
    setSelectedAssetId(id);
    if (!existing) {
      void getAssetById(id).then(({ asset }) => {
        useAppStore.setState((state) => ({ assets: [asset, ...state.assets.filter((entry) => entry.id !== asset.id)] }));
        setDetailAssetOverride(asset);
      }).catch(() => {});
    }
  }, [pendingAssetDetailId, setFilters]);
  const hadKeyingRef = useRef(false);
  useEffect(() => {
    if (keyingTarget) { hadKeyingRef.current = true; return; }
    if (hadKeyingRef.current) {
      hadKeyingRef.current = false;
      void loadAssets(true);
    }
  }, [keyingTarget, loadAssets]);
  const kindItems = useMemo<SelectItem<KindValue>[]>(() => [
    { value: "", label: t("assets.kindAll") },
    ...kinds.map((k) => ({ value: k, label: t(`assets.kind${k[0].toUpperCase()}${k.slice(1)}`) })),
  ], [t]);
  useEffect(() => { void loadAssets(true); }, [loadAssets]);
  useEffect(() => { const timer = window.setTimeout(() => setFilters({ q: query }), 300); return () => window.clearTimeout(timer); }, [query, setFilters]);
  const filtered = Boolean(filters.q || filters.kind || filters.tag);
  const empty = assets.length === 0 && !loading;
  // The pinned Element Library view (kind=element, no folder/query/tag) gets its
  // own empty state and must be decided BEFORE the generic `filtered` branch —
  // kind alone makes `filtered` true, which would shadow it with emptySearch.
  const elementRootView = filters.kind === "element" && !filters.folderId && !filters.q && !filters.tag;
  const emptyTitle = elementRootView ? "assets.emptyElementsTitle" : filters.folderId ? "assets.emptyFolderTitle" : filtered ? "assets.emptySearchTitle" : "assets.emptyTitle";
  const emptyBody = elementRootView ? "assets.emptyElementsBody" : filters.folderId ? "assets.emptyFolderBody" : filtered ? "assets.emptySearchBody" : "assets.emptyBody";
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId)
    ?? (detailAssetOverride?.id === selectedAssetId ? detailAssetOverride : null);
  const selectedElement = selectedAsset?.kind === "element" ? toElementDefinition(selectedAsset) : null;
  const closeDetail = useCallback(() => setSelectedAssetId(null), []);
  const detailRef = useMobileAssetDetailDialog(Boolean(selectedAsset && isMobile), closeDetail);
  const closePreview = useCallback(() => setPreviewItem(null), []);
  const saveElement = async (draft: ElementDraft) => {
    if (!draft.id || !await updateAssetItem(draft.id, { name: draft.name, notes: draft.notes })) showToast(t("assets.actionFailed"), true);
  };
  const saveElementBindings = async (id: string, bindings: import("../../lib/characterBinding").CharacterProviderBinding[]) => {
    const asset = assets.find((entry) => entry.id === id);
    const metadata = { ...(asset?.metadata ?? {}), characterBindings: bindings };
    const ok = await updateAssetItem(id, { metadata });
    if (!ok) showToast(t("assets.actionFailed"), true);
    return ok;
  };
  const renameAsset = async (id: string, name: string) => {
    const renamed = await updateAssetItem(id, { name });
    if (!renamed) showToast(t("assets.actionFailed"), true);
    return renamed;
  };
  const deleteElement = async (id: string) => { if (await deleteAssetItem(id)) closeDetail(); else showToast(t("assets.actionFailed"), true); };
  const runTestSheet = async () => showToast(t("assets.testSheetsUnavailable"), true);
  return <section className={`assets-workspace${selectedAsset ? " assets-workspace--detail-open" : ""}`} aria-labelledby="assets-title">
    <AssetsFolderTree />
    <main className="assets-workspace__main">
      <header className="assets-toolbar"><div className="assets-toolbar__title"><h1 id="assets-title">{t("assets.title")}</h1><span>{t("assets.itemCount", { count: assets.length })}</span></div>
        <div className="assets-toolbar__controls"><input type="search" value={query} placeholder={t("assets.searchPlaceholder")} aria-label={t("assets.searchPlaceholder")} onChange={(e) => setQuery(e.target.value)} />
          <Select<KindValue> items={kindItems} value={(filters.kind ?? "") as KindValue} onChange={(v) => setFilters({ kind: v || null })} ariaLabel={t("assets.kindAll")} />
          {assets.length > 0 && <button type="button" className="assets-clear-btn" onClick={async () => { if (confirm(t("assets.clearConfirm"))) { await apiClearAll(); void loadAssets(true); } }}>{t("assets.clearAll")}</button>}
        </div>
        {tags.length > 0 && <div className="assets-tag-filter">{tags.map((tag) => <button type="button" key={tag} className={filters.tag === tag ? "is-active" : ""} onClick={() => setFilters({ tag: filters.tag === tag ? null : tag })}>{tag}</button>)}</div>}
      </header>
      {loadError && assets.length === 0 ? (
        <div className="assets-empty" role="alert">
          <h2>{t("assets.loadErrorTitle")}</h2>
          <p>{t("assets.loadErrorBody")}</p>
          <button type="button" className="assets-empty__cta" onClick={() => void loadAssets(true)}>{t("assets.retry")}</button>
        </div>
      ) : empty ? (
        <div className="assets-empty">
          <h2>{t(emptyTitle)}</h2>
          <p>{t(emptyBody)}</p>
          {elementRootView || (!filtered && !filters.folderId) ? (
            <button type="button" className="assets-empty__cta" onClick={() => setUIMode("classic")}>{t("nav.create")}</button>
          ) : null}
        </div>
      ) : <AssetsGrid selectedId={selectedAssetId ?? undefined} onSelectAsset={setSelectedAssetId} onPreviewAsset={(asset) => setPreviewItem(assetToPreviewItem(asset))} />}
    </main>
    {selectedAsset && isMobile ? (
      <button type="button" className="assets-workspace__detail-backdrop"
        aria-label={t("assets.detailClose")} onClick={closeDetail} />
    ) : null}
    {selectedAsset && <aside ref={detailRef} className="assets-workspace__detail"
      role={isMobile ? "dialog" : undefined} aria-modal={isMobile ? true : undefined}
      aria-label={t("assets.detailAria", { name: selectedAsset.name })}>
      <button type="button" className="assets-workspace__detail-close" onClick={closeDetail} aria-label={t("assets.detailClose")}>×</button>
      {selectedElement ? <ElementDetail element={selectedElement} saving={false} testing={false} onSave={saveElement} onSaveBindings={saveElementBindings} onDelete={deleteElement} onRunTestSheet={runTestSheet} /> : <AssetMetaDetail asset={selectedAsset} onRename={(name) => renameAsset(selectedAsset.id, name)} />}
    </aside>}
    <KeyingPanel />
    {previewItem ? <AssetMediaLightbox item={previewItem} onClose={closePreview} /> : null}
  </section>;
}

function AssetMetaDetail({ asset, onRename }: { asset: AssetItem; onRename: (name: string) => Promise<boolean> }) {
  const { t, locale } = useI18n();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(asset.name);
  const renamePendingRef = useRef(false);
  const prompt = typeof asset.metadata?.prompt === "string" ? asset.metadata.prompt : null;
  const provider = typeof asset.metadata?.provider === "string" ? asset.metadata.provider : null;

  useEffect(() => {
    setName(asset.name);
    setEditing(false);
  }, [asset.id, asset.name]);

  async function commitRename() {
    if (renamePendingRef.current) return;
    const next = name.trim();
    if (!next || next === asset.name) {
      setName(asset.name);
      setEditing(false);
      return;
    }
    renamePendingRef.current = true;
    try {
      if (!await onRename(next)) setName(asset.name);
    } finally {
      renamePendingRef.current = false;
      setEditing(false);
    }
  }

  return (
    <div className="assets-workspace__detail-meta">
      <div className="assets-workspace__detail-title">
        {editing ? (
          <input className="assets-folder-input assets-workspace__detail-name-input" value={name} autoFocus
            aria-label={t("assets.renameAsset")} onChange={(event) => setName(event.target.value)}
            onBlur={() => void commitRename()} onKeyDown={(event) => {
              if (event.key === "Enter") void commitRename();
              if (event.key === "Escape") { setName(asset.name); setEditing(false); }
            }} />
        ) : (
          <><h2>{asset.name}</h2><button type="button" className="assets-workspace__detail-rename"
            aria-label={t("assets.renameAsset")} title={t("assets.renameAsset")}
            onClick={() => setEditing(true)}><EditIcon /></button></>
        )}
      </div>
      <dl>
        <dt>{t("assets.detailKind")}</dt>
        <dd>{t(`assets.kind${asset.kind[0].toUpperCase()}${asset.kind.slice(1)}`)}</dd>
        <dt>{t("assets.detailCreated")}</dt>
        <dd>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(asset.createdAt))}</dd>
        {provider ? (<><dt>{t("assets.detailProvider")}</dt><dd>{provider}</dd></>) : null}
        {prompt ? (<><dt>{t("assets.detailPrompt")}</dt><dd className="assets-workspace__detail-prompt">{prompt}</dd></>) : null}
        {asset.tags.length > 0 ? (<><dt>{t("assets.detailTags")}</dt><dd>{asset.tags.join(", ")}</dd></>) : null}
      </dl>
    </div>
  );
}

function toElementDefinition(asset: AssetItem): ElementDefinition {
  const metadata = asset.metadata ?? {};
  const kind = metadata.elementKind;
  const refs = metadata.refs;
  const characterBindings = Array.isArray(metadata.characterBindings) ? metadata.characterBindings as ElementDefinition["characterBindings"] : undefined;
  return { id: asset.id, name: asset.name, kind: kind === "product" || kind === "style" || kind === "scene" ? kind : "character", refs: Array.isArray(refs) ? refs.filter((ref): ref is string => typeof ref === "string") : asset.filePath ? [asset.filePath] : [], notes: asset.notes ?? undefined, defaultStrength: typeof metadata.defaultStrength === "number" ? metadata.defaultStrength : undefined, characterBindings };
}
