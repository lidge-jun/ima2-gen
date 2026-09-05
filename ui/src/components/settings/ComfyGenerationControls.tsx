import { useId } from "react";
import { useAppStore } from "../../store/useAppStore";
import { useI18n } from "../../i18n";
import { Select, type SelectGroup } from "../controls/Select";
import { useLaneCatalog } from "../../hooks/useLaneCatalog";
import { getLaneCatalogSnapshot, type LaneCatalogSnapshot } from "../../lib/laneCatalog";
import { COMFY_VIDEO_VALUE_PREFIX } from "../../lib/imageModels";
import { PROVIDER_SURFACE_SUPPORT } from "../../generated/providers";
import { deriveComfyDisplay, comfyDisplayMessageKey, isComfyModelAvailable, type ComfyDisplay } from "../../lib/comfyDisplay";
import type { Provider } from "../../types";

function workflowChoices(snapshot: LaneCatalogSnapshot, display: ComfyDisplay, value: string, t: (key: string) => string) {
  const lane = snapshot.catalog?.comfy;
  const fresh = snapshot.phase === "ready" && lane?.status === "ready";
  const groups: SelectGroup<string>[] = [];
  for (const kind of ["image", "video"] as const) {
    if (!(kind === "image" ? PROVIDER_SURFACE_SUPPORT.comfy.generate.supported : PROVIDER_SURFACE_SUPPORT.comfy.video.supported)) continue;
    groups.push({ label: t(kind === "image" ? "comfy.kindImage" : "comfy.kindVideo"),
      items: (lane?.models[kind] ?? []).map((entry) => ({
        value: kind === "video" ? `${COMFY_VIDEO_VALUE_PREFIX}${entry.id}` : entry.id,
        label: entry.label, stacked: true, disabled: !fresh || !isComfyModelAvailable(entry),
        title: entry.executable === false ? t("comfy.display.selectedLocked")
          : entry.description?.endsWith("(offline)") ? t("comfy.display.selectedOffline") : undefined,
      })) });
  }
  if (value && !groups.some((group) => group.items.some((item) => item.value === value))) {
    groups.unshift({ items: [{ value, label: display.selected?.id ?? value, disabled: true, title: t("comfy.display.selectedMissing") }] });
  }
  return groups;
}

function chooseWorkflow(next: string, context: { provider: Provider; mcpProvider: string | null }) {
  const current = useAppStore.getState();
  if (current.provider !== "comfy" || current.mcpProvider || current.provider !== context.provider
    || (current.mcpProvider ?? null) !== context.mcpProvider) return;
  const video = next.startsWith(COMFY_VIDEO_VALUE_PREFIX);
  const id = video ? next.slice(COMFY_VIDEO_VALUE_PREFIX.length) : next;
  const admitted = deriveComfyDisplay(getLaneCatalogSnapshot(), video ? { comfyVideoWorkflow: id } : { comfyWorkflow: id });
  if (!admitted.selectedAvailable) return;
  if (video) current.setComfyVideoWorkflow(id); else current.setComfyWorkflow(id);
}

export function ComfyGenerationControls() {
  const { t } = useI18n();
  const instanceId = useId();
  const statusId = `${instanceId}-status`, selectId = `${instanceId}-workflow`;
  const provider = useAppStore((s) => s.provider);
  const mcpProvider = useAppStore((s) => s.mcpProvider ?? null);
  const comfyWorkflow = useAppStore((s) => s.comfyWorkflow);
  const comfyVideoWorkflow = useAppStore((s) => s.comfyVideoWorkflow);
  const openSettings = useAppStore((s) => s.openSettings);
  const snapshot = useLaneCatalog();
  const display = deriveComfyDisplay(snapshot, { comfyWorkflow, comfyVideoWorkflow });
  const value = comfyVideoWorkflow ? `${COMFY_VIDEO_VALUE_PREFIX}${comfyVideoWorkflow}` : comfyWorkflow ?? "";
  const groups = workflowChoices(snapshot, display, value, t);
  if (provider !== "comfy" || mcpProvider) return null;
  return (
    <div className="option-group comfy-generation-controls" data-testid="comfy-generation-controls" aria-busy={snapshot.phase === "loading"}>
      <label className="section-title" htmlFor={selectId}>{t("comfy.workflowsTitle")}</label>
      <p id={statusId} className="option-help">
        {t(comfyDisplayMessageKey(display, snapshot))}
        {snapshot.observedAt !== null ? ` · ${t("comfy.display.lastChecked", { time: new Date(snapshot.observedAt).toLocaleTimeString() })}` : ""}
      </p>
      <Select
        id={selectId} groups={groups} value={value}
        onChange={(next) => chooseWorkflow(next, { provider, mcpProvider })}
        ariaLabel={t("comfy.display.chooseWorkflow")}
        ariaDescribedBy={statusId}
        placeholder={t("comfy.display.chooseWorkflow")}
        portal
      />
      {display.selected ? <p className="option-help">{t(display.selected.kind === "video" ? "comfy.kindVideo" : "comfy.kindImage")}: {display.selected.label}<br /><code>{display.selected.id}</code></p> : null}
      <p className="option-help">{t("comfy.display.controlsHelp")}</p>
      <div className="option-row">
        <button type="button" className="option-btn" onClick={() => void snapshot.refresh()}>{t("comfy.display.refresh")}</button>
        <button type="button" className="option-btn" onClick={() => openSettings("providers")}>{t("comfy.display.manage")}</button>
      </div>
    </div>
  );
}
