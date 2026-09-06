import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { useAppStore } from "../store/useAppStore";
import { readMcpModelObservation, readMcpProviderObservation } from "../lib/mcpProviders";
import { deriveMcpReadiness, parseMcpReadinessData, type McpReadinessObservation } from "../lib/mcpReadiness";

export function McpReadinessDetails() {
  const { t } = useI18n();
  const provider = useAppStore((state) => state.mcpProvider ?? "");
  const model = useAppStore((state) => state.mcpModel ?? null);
  const kind = useAppStore((state) => state.mcpMediaKind ?? "image");
  const [revision, retry] = useState(0);
  const [observation, setObservation] = useState<McpReadinessObservation>({
    selection: { provider, model, kind }, phase: "loading", observedAt: null, providers: [], catalog: null,
  });
  useEffect(() => {
    const controller = new AbortController(), selection = { provider, model, kind };
    setObservation({ selection, phase: "loading", observedAt: null, providers: [], catalog: null });
    const read = async () => {
      try {
        const rawProviders = await readMcpProviderObservation(controller.signal);
        const first = parseMcpReadinessData(rawProviders, null);
        const selected = first.providers.find((row) => row.id === provider);
        const rawCatalog = selected?.enabled && selected.status.state === "connected"
          && selected.executable !== false && model !== null ? await readMcpModelObservation(provider, controller.signal) : null;
        const parsed = parseMcpReadinessData(rawProviders, rawCatalog);
        if (!controller.signal.aborted) setObservation({ ...parsed, selection, phase: "ready", observedAt: Date.now() });
      } catch {
        if (!controller.signal.aborted) setObservation({ selection, phase: "error", observedAt: null, providers: [], catalog: null });
      }
    };
    if (provider) void read();
    return () => controller.abort();
  }, [provider, model, kind, revision]);
  if (!provider) return null;
  const readiness = deriveMcpReadiness(observation, { provider, model, kind });
  const messageKey = `readiness.mcp.${readiness.code}`;
  return <div className="provider-readiness__body" data-mcp-readiness={readiness.code} aria-busy={readiness.code === "loading"}>
    <p role="status" aria-live="polite"><strong>{t(messageKey)}</strong></p>
    <dl className="provider-readiness__facts">
      <div><dt>{t("readiness.provider")}</dt><dd>{provider} · MCP</dd></div>
      <div><dt>{t("readiness.model")}</dt><dd style={{ minWidth: 0, overflowWrap: "anywhere" }}>{readiness.modelLabel ?? t("readiness.mcp.default")}</dd></div>
      <div><dt>{t("comfy.colKind")}</dt><dd>{t(kind === "video" ? "grokMode.video" : "grokMode.image")}</dd></div>
    </dl>
    {readiness.observedAt !== null ? <small>{t("readiness.mcp.observed", { time: new Date(readiness.observedAt).toLocaleTimeString() })}</small> : null}
    <button type="button" className="modal__btn modal__btn--secondary" onClick={() => retry((value) => value + 1)}>{t("readiness.mcp.refresh")}</button>
  </div>;
}
