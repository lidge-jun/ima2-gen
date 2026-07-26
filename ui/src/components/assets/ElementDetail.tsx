import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../i18n";
import { Segmented } from "../controls/Segmented";
import { ElementRefGrid, type ElementRefDraft } from "./ElementRefGrid";
import { CharacterBindingsCard } from "./CharacterBindingsCard";
import type { CharacterProviderBinding } from "../../lib/characterBinding";
import "../../styles/element-detail.css";

export type ElementKind = "character" | "product" | "style" | "scene";

export interface ElementDefinition {
  id: string;
  name: string;
  kind: ElementKind;
  refs: string[];
  notes?: string;
  defaultStrength?: number;
  characterBindings?: CharacterProviderBinding[];
}

export interface ElementDraft {
  id?: string;
  name: string;
  kind: ElementKind;
  refs: ElementRefDraft[];
  notes: string;
  defaultStrength: number;
}

type Props = {
  element: ElementDefinition | null;
  saving: boolean;
  testing: boolean;
  onSave: (draft: ElementDraft) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onRunTestSheet: (id: string) => Promise<void>;
  onSaveBindings?: (id: string, bindings: CharacterProviderBinding[]) => Promise<boolean>;
};

const KINDS: ElementKind[] = ["character", "product", "style", "scene"];
/** "character" -> "Character" so it lines up with the element.kind* / element.help* keys. */
const kindKey = (kind: ElementKind) => kind[0].toUpperCase() + kind.slice(1);

function toDraft(element: ElementDefinition | null): ElementDraft {
  return { id: element?.id, name: element?.name ?? "", kind: element?.kind ?? "character", refs: (element?.refs ?? []).filter((p) => typeof p === "string" && p.length > 0).map((path, index) => ({ id: `${element?.id ?? "new"}-${index}-${path}`, path, previewUrl: `/generated/${path.split("/").map(encodeURIComponent).join("/")}`, alt: "" })), notes: element?.notes ?? "", defaultStrength: element?.defaultStrength ?? 0.75 };
}

export function ElementDetail({ element, saving, testing, onSave, onDelete, onRunTestSheet, onSaveBindings }: Props) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<ElementDraft>(() => toDraft(element));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setDraft(toDraft(element)); setError(null); }, [element]);
  const remaining = 800 - draft.notes.length;
  const notePreview = useMemo(() => draft.notes.trim() ? `[Element: ${draft.name.trim() || "Untitled"}] ${draft.notes.trim()}` : null, [draft.name, draft.notes]);
  const update = <K extends keyof ElementDraft>(key: K, value: ElementDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async () => {
    if (!draft.name.trim()) return setError(t("element.errorName"));
    if (!draft.refs.length) return setError(t("element.errorRefs"));
    setError(null);
    await onSave({ ...draft, name: draft.name.trim(), notes: draft.notes.trim() ? draft.notes : "" });
  };

  const kindItems = KINDS.map((value) => ({ value, label: t(`element.kind${kindKey(value)}`) }));

  return <aside className="element-detail" aria-label={t("element.ariaLabel")}>
    <header className="element-detail__header"><div><span>{t("element.title")}</span><h2>{element ? t("element.titleEdit") : t("element.titleNew")}</h2></div>{element ? <span className="element-detail__status">{t("element.saved")}</span> : null}</header>
    <label className="element-detail__field">{t("element.name")}<input value={draft.name} maxLength={120} placeholder={t("element.namePlaceholder")} onChange={(event) => update("name", event.target.value)} /></label>
    <Segmented<ElementKind> title={t("element.kind")} items={kindItems} value={draft.kind} onChange={(kind) => update("kind", kind)} />
    <p className="element-detail__kind-help">{t(`element.help${kindKey(draft.kind)}`)}</p>
    <ElementRefGrid refs={draft.refs} onChange={(refs) => update("refs", refs)} maxRefs={6} />
    {element && draft.kind === "character" && onSaveBindings ? (
      <CharacterBindingsCard
        bindings={element.characterBindings ?? []}
        refs={element.refs}
        onSave={(bindings) => onSaveBindings(element.id, bindings)}
      />
    ) : null}
    <section className="element-detail__section"><div className="element-detail__section-heading"><div><h3>{t("element.notes")}</h3><p>{t("element.notesHelp")}</p></div>{remaining <= 100 ? <span>{t("element.remaining", { n: remaining })}</span> : null}</div><textarea value={draft.notes} maxLength={800} rows={6} placeholder={t("element.notesPlaceholder")} onChange={(event) => update("notes", event.target.value)} />{notePreview ? <p className="element-detail__note-preview">{notePreview}</p> : null}</section>
    <section className="element-detail__section"><div className="element-detail__section-heading"><div><h3>{t("element.strength")}</h3><p>{t("element.strengthHelp")}</p></div><output>{draft.defaultStrength.toFixed(2)}</output></div><input className="element-detail__strength" type="range" min="0" max="1" step="0.05" value={draft.defaultStrength} onChange={(event) => update("defaultStrength", Number(event.target.value))} /><button type="button" className="element-detail__reset" onClick={() => update("defaultStrength", 0.75)}>{t("element.resetDefault")}</button></section>
    {error ? <p className="element-detail__error" role="alert">{error}</p> : null}
    <footer className="element-detail__actions"><button type="button" className="element-detail__save" disabled={saving} onClick={() => void save()}>{saving ? t("element.saving") : t("element.save")}</button><button type="button" disabled={!element || testing} onClick={() => element && void onRunTestSheet(element.id)}>{testing ? t("element.testing") : t("element.runTest")}</button>{element && onDelete ? <button type="button" className="is-danger" onClick={() => void onDelete(element.id)}>{t("element.delete")}</button> : null}</footer>
  </aside>;
}
