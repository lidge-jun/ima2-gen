import { useI18n } from "../../i18n";
import type {
  CardNewsRenderMode,
  CardNewsTextField,
  CardNewsTextHierarchy,
  CardNewsTextKind,
  CardNewsTextPlacement,
} from "../../lib/cardNewsApi";
import { PlacementBadge, placementLabel } from "./PlacementBadge";

const TEXT_KINDS: CardNewsTextKind[] = ["headline", "body", "caption", "cta", "badge", "number"];
const PLACEMENTS: CardNewsTextPlacement[] = [
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
  "free",
];
const RENDER_MODES: CardNewsRenderMode[] = ["in-image", "ui-only"];
const HIERARCHIES: CardNewsTextHierarchy[] = ["primary", "secondary", "supporting"];

type TextFieldCardProps = {
  field: CardNewsTextField;
  locked: boolean;
  onChange: (patch: Partial<CardNewsTextField>) => void;
  onRemove?: () => void;
};

function enumLabel(group: string, value: string, t: (key: string) => string): string {
  const key = `cardNews.${group}.${value}`;
  const label = t(key);
  return label === key ? value : label;
}

export function TextFieldCard({ field, locked, onChange, onRemove }: TextFieldCardProps) {
  const { t } = useI18n();
  const chars = field.text.length;
  const overLimit = typeof field.maxChars === "number" && chars > field.maxChars;
  const useTextarea = field.maxChars === null || field.maxChars > 80;

  return (
    <div className="card-news-text-field-card">
      <div className="card-news-text-field-card__header">
        <span>{enumLabel("textKinds", field.kind, t)}</span>
        <PlacementBadge placement={field.placement} />
      </div>

      <label className="card-news-field">
        <span>{t("cardNews.textFieldText")}</span>
        {useTextarea ? (
          <textarea
            value={field.text}
            disabled={locked}
            onChange={(e) => onChange({ text: e.target.value, source: "user" })}
          />
        ) : (
          <input
            value={field.text}
            disabled={locked}
            onChange={(e) => onChange({ text: e.target.value, source: "user" })}
          />
        )}
      </label>

      <div className="card-news-text-field-card__grid">
        <label className="card-news-field">
          <span>{t("cardNews.textKind")}</span>
          <select
            value={field.kind}
            disabled={locked}
            onChange={(e) => onChange({ kind: e.target.value as CardNewsTextKind, source: "user" })}
          >
            {TEXT_KINDS.map((kind) => (
              <option key={kind} value={kind}>{enumLabel("textKinds", kind, t)}</option>
            ))}
          </select>
        </label>

        <label className="card-news-field">
          <span>{t("cardNews.placement")}</span>
          <select
            value={field.placement}
            disabled={locked}
            onChange={(e) => onChange({ placement: e.target.value as CardNewsTextPlacement, source: "user" })}
          >
            {PLACEMENTS.map((placement) => (
              <option key={placement} value={placement}>{placementLabel(placement, t)}</option>
            ))}
          </select>
        </label>

        <label className="card-news-field">
          <span>{t("cardNews.renderMode")}</span>
          <select
            value={field.renderMode}
            disabled={locked}
            onChange={(e) => onChange({ renderMode: e.target.value as CardNewsRenderMode, source: "user" })}
          >
            {RENDER_MODES.map((mode) => (
              <option key={mode} value={mode}>{enumLabel("renderModes", mode, t)}</option>
            ))}
          </select>
        </label>

        <label className="card-news-field">
          <span>{t("cardNews.hierarchyLabel")}</span>
          <select
            value={field.hierarchy}
            disabled={locked}
            onChange={(e) => onChange({ hierarchy: e.target.value as CardNewsTextHierarchy, source: "user" })}
          >
            {HIERARCHIES.map((hierarchy) => (
              <option key={hierarchy} value={hierarchy}>{enumLabel("hierarchy", hierarchy, t)}</option>
            ))}
          </select>
        </label>
      </div>

      <div className={`card-news-text-field-card__meta${overLimit ? " over" : ""}`}>
        <span>{field.maxChars === null ? chars : `${chars}/${field.maxChars}`}</span>
        {overLimit ? <span>{t("cardNews.textTooLong")}</span> : null}
        {onRemove ? (
          <button type="button" disabled={locked} onClick={onRemove}>
            {t("cardNews.removeTextField")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
