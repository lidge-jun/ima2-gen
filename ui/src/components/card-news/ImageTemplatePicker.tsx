import { useCardNewsStore } from "../../store/cardNewsStore";
import { useI18n } from "../../i18n";

function summarizeSlots(template: { slots: Array<{ kind: string; textKind: string | null }> }) {
  const textSlots = template.slots.filter((slot) => slot.kind === "text" || slot.textKind).length;
  const imageSlots = template.slots.filter((slot) => slot.kind === "image").length;
  return `${textSlots} text / ${imageSlots} image`;
}

export function ImageTemplatePicker() {
  const { t } = useI18n();
  const templates = useCardNewsStore((s) => s.templates);
  const selected = useCardNewsStore((s) => s.imageTemplateId);
  const setImageTemplate = useCardNewsStore((s) => s.setImageTemplate);

  return (
    <section className="card-news-panel">
      <div className="card-news-panel__head">
        <span>{t("cardNews.imageTemplate")}</span>
        <button type="button" disabled title={t("cardNews.newTemplateLater")}>+</button>
      </div>
      <div className="card-news-template-grid">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            className={`card-news-template${selected === template.id ? " selected" : ""}`}
            onClick={() => setImageTemplate(template.id)}
          >
            <img src={template.previewUrl} alt="" />
            <span className="card-news-template__body">
              <span className="card-news-template__name">{template.name}</span>
              <span className="card-news-template__meta">{summarizeSlots(template)}</span>
              <span className="card-news-template__sizes">{template.recommendedOutputSizes.join(" · ")}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
