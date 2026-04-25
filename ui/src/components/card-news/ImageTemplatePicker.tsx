import { useCardNewsStore } from "../../store/cardNewsStore";
import { useI18n } from "../../i18n";

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
            <span>{template.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
