import { useEffect, useRef, useState, type DragEvent } from "react";
import { useI18n } from "../../i18n";

export interface ElementRefDraft {
  id: string;
  path: string;
  previewUrl: string;
  alt: string;
}

type Props = {
  refs: ElementRefDraft[];
  onChange: (refs: ElementRefDraft[]) => void;
  maxRefs?: number;
};

const UNDO_MS = 5000;

export function ElementRefGrid({ refs, onChange, maxRefs = 6 }: Props) {
  const { t } = useI18n();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ ref: ElementRefDraft; index: number } | null>(null);
  const undoTimer = useRef<number | null>(null);

  useEffect(() => () => { if (undoTimer.current) window.clearTimeout(undoTimer.current); }, []);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= refs.length || from === to) return;
    const next = [...refs];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const remove = (index: number) => {
    if (refs.length <= 1) return;
    const removed = refs[index];
    onChange(refs.filter((_, current) => current !== index));
    setUndo({ ref: removed, index });
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndo(null), UNDO_MS);
  };

  const restore = () => {
    if (!undo || refs.some((ref) => ref.path === undo.ref.path)) return;
    const next = [...refs];
    next.splice(Math.min(undo.index, next.length), 0, undo.ref);
    onChange(next.slice(0, maxRefs));
    setUndo(null);
  };

  const dropOn = (event: DragEvent<HTMLDivElement>, targetIndex: number) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("application/ima2-element-ref") || draggedId;
    const sourceIndex = refs.findIndex((ref) => ref.id === sourceId);
    setDraggedId(null);
    if (sourceIndex < 0 || sourceIndex === targetIndex) return;
    const source = refs[sourceIndex];
    const duplicate = refs.find((ref, index) => index !== sourceIndex && ref.path === source.path);
    if (duplicate) {
      setDuplicateId(duplicate.id);
      window.setTimeout(() => setDuplicateId(null), 1200);
      return;
    }
    move(sourceIndex, targetIndex);
  };

  const updateAlt = (index: number, alt: string) => onChange(refs.map((ref, current) => current === index ? { ...ref, alt } : ref));

  return <section className="element-ref-grid" aria-labelledby="element-refs-title">
    <div className="element-detail__section-heading">
      <div><h3 id="element-refs-title">{t("element.refsTitle")}</h3><p>{t("element.refsHelp")}</p></div>
      <span>{refs.length} / {maxRefs}</span>
    </div>
    <div className="element-ref-grid__items">
      {refs.map((ref, index) => <div
        key={ref.id}
        className={`element-ref-card${draggedId === ref.id ? " is-dragging" : ""}${duplicateId === ref.id ? " is-duplicate" : ""}`}
        draggable
        onDragStart={(event) => { setDraggedId(ref.id); event.dataTransfer.setData("application/ima2-element-ref", ref.id); event.dataTransfer.effectAllowed = "move"; }}
        onDragEnd={() => setDraggedId(null)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => dropOn(event, index)}
      >
        <div className="element-ref-card__image"><img src={ref.previewUrl || ref.path} alt={ref.alt || t("element.refAlt", { n: index + 1 })} />{index === 0 ? <span>{t("element.refPrimary")}</span> : null}</div>
        <div className="element-ref-card__controls">
          <label>{t("element.refLabel")}<input value={ref.alt} maxLength={80} placeholder={t("element.refLabelPlaceholder")} onChange={(event) => updateAlt(index, event.target.value)} /></label>
          <div><button type="button" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label={t("element.refMoveUp", { n: index + 1 })}>↑</button><button type="button" disabled={index === refs.length - 1} onClick={() => move(index, index + 1)} aria-label={t("element.refMoveDown", { n: index + 1 })}>↓</button><button type="button" className="is-danger" disabled={refs.length <= 1} onClick={() => remove(index)} aria-label={t("element.refRemove")}>{t("element.refRemove")}</button></div>
        </div>
      </div>)}
    </div>
    {undo ? <div className="element-ref-grid__undo" role="status"><span>{t("element.refRemoved")}</span><button type="button" onClick={restore}>{t("element.refUndo")}</button></div> : null}
  </section>;
}
