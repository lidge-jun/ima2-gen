export type ElementMentionKind = "character" | "product" | "style" | "scene" | "reference";

export interface ElementMentionChipProps {
  elementId: string;
  name: string;
  kind?: ElementMentionKind;
  thumbnail?: string;
  missing?: boolean;
  ariaLabel: string;
  unavailableLabel: string;
  removeLabel: string;
  onRemove(elementId: string): void;
  onOpen?(elementId: string): void;
}

function KindIcon({ kind = "character" }: { kind?: ElementMentionKind }) {
  const paths: Record<ElementMentionKind, string> = {
    character: "M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5 6c.4-2.2 2.2-3.5 5-3.5s4.6 1.3 5 3.5",
    product: "M3 5.5 8 2l5 3.5v6L8 15l-5-3.5v-6ZM3 5.5 8 9l5-3.5M8 9v6",
    style: "m3 11 5-8 5 8-5 2-5-2Zm5-8v10",
    scene: "M2 13 6.5 8l3 3 2-2 2.5 4H2ZM2 3h12v12H2z",
    reference: "M2 3h12v10H2zM2 10l3.5-3.5 3 3L11 7l3 3",
  };
  return <svg className="element-mention-chip__kind" viewBox="0 0 16 16" aria-hidden="true"><path d={paths[kind]} /></svg>;
}

export function ElementMentionChip({ elementId, name, kind, thumbnail, missing, ariaLabel, unavailableLabel, removeLabel, onRemove, onOpen }: ElementMentionChipProps) {
  return (
    <span className={`element-mention-chip${missing ? " is-missing" : ""}`} data-element-id={elementId}>
      <button type="button" className="element-mention-chip__body" onClick={() => onOpen?.(elementId)} aria-label={ariaLabel}>
        {thumbnail ? <img className="element-mention-chip__thumbnail" src={thumbnail} alt="" /> : <span className="element-mention-chip__thumbnail is-empty" aria-hidden="true" />}
        {missing ? <span className="element-mention-chip__warning" aria-label={unavailableLabel}>!</span> : <KindIcon kind={kind} />}
        <span className="element-mention-chip__name">{name}</span>
      </button>
      <button type="button" className="element-mention-chip__remove" onClick={() => onRemove(elementId)} aria-label={removeLabel}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8" /></svg>
      </button>
    </span>
  );
}
