import { selectElementItems, type TrayItem } from "../../lib/referenceTray";
import type { AssetItem } from "../../store/storeTypes";
import {
  ElementMentionChip,
  type ElementMentionKind,
} from "../ElementMentionChip";
import { ChipRow } from "../controls";

const elementKinds = new Set<ElementMentionKind>([
  "character",
  "product",
  "style",
  "scene",
]);

export type ElementMentionChipModel = {
  elementId: string;
  name: string;
  kind: ElementMentionKind;
  thumbnail?: string;
  missing: boolean;
};

function catalogKind(asset: AssetItem | undefined): ElementMentionKind {
  const kind = asset?.metadata?.elementKind;
  return typeof kind === "string" && elementKinds.has(kind as ElementMentionKind)
    ? kind as ElementMentionKind
    : "character";
}

function catalogThumbnail(asset: AssetItem | undefined): string | undefined {
  if (!asset) return undefined;
  const refs = asset.metadata?.refs;
  const path = Array.isArray(refs)
    ? refs.find((ref): ref is string => typeof ref === "string" && ref.length > 0)
    : undefined;
  return path
    ? `/generated/${path.split("/").map(encodeURIComponent).join("/")}`
    : undefined;
}

export function buildElementMentionChipModels(
  items: readonly TrayItem[],
  assets: readonly AssetItem[] | null,
  missingElementIds: readonly string[],
): ElementMentionChipModel[] {
  const catalog = new Map((assets ?? []).map((asset) => [asset.id, asset]));
  const missingIds = new Set(missingElementIds);
  return selectElementItems({ trayItems: [...items] }).map((item) => {
    const asset = catalog.get(item.source.elementId);
    return {
      elementId: item.source.elementId,
      name: asset?.name ?? item.source.nameAtInsertion,
      kind: catalogKind(asset),
      thumbnail: catalogThumbnail(asset) ?? item.source.thumbnailUrl,
      missing: missingIds.has(item.source.elementId) || (assets !== null && !asset),
    };
  });
}

type ElementMentionChipsProps = {
  items: readonly TrayItem[];
  assets: readonly AssetItem[] | null;
  missingElementIds: readonly string[];
  selectedLabel: string;
  unavailableLabel: string;
  kindLabel(kind: ElementMentionKind): string;
  mentionLabel(name: string, kind: string, missing: boolean): string;
  removeLabel(name: string): string;
  onRemove(elementId: string): void;
};

export function ElementMentionChips(props: ElementMentionChipsProps) {
  const models = buildElementMentionChipModels(
    props.items,
    props.assets,
    props.missingElementIds,
  );
  if (models.length === 0) return null;
  return (
    <ChipRow ariaLabel={props.selectedLabel}>
      {models.map((model) => {
        const kindLabel = props.kindLabel(model.kind);
        return (
          <ElementMentionChip
            key={model.elementId}
            {...model}
            ariaLabel={props.mentionLabel(model.name, kindLabel, model.missing)}
            unavailableLabel={props.unavailableLabel}
            removeLabel={props.removeLabel(model.name)}
            onRemove={props.onRemove}
          />
        );
      })}
    </ChipRow>
  );
}
