import { useCardNewsStore } from "../../store/cardNewsStore";
import { useI18n } from "../../i18n";

export function RoleTemplatePicker() {
  const { t } = useI18n();
  const roles = useCardNewsStore((s) => s.roleTemplates);
  const selected = useCardNewsStore((s) => s.roleTemplateId);
  const setRoleTemplate = useCardNewsStore((s) => s.setRoleTemplate);

  return (
    <section className="card-news-panel">
      <div className="card-news-panel__head">
        <span>{t("cardNews.roleTemplate")}</span>
      </div>
      <div className="card-news-role-row">
        {roles.map((template) => (
          <button
            key={template.id}
            type="button"
            className={selected === template.id ? "selected" : ""}
            onClick={() => setRoleTemplate(template.id)}
          >
            {template.name}
          </button>
        ))}
      </div>
    </section>
  );
}
