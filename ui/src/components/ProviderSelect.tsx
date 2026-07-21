import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { useOAuthStatus } from "../hooks/useOAuthStatus";
import { useBilling } from "../hooks/useBilling";
import { useGrokStatus } from "../hooks/useGrokStatus";
import { useKeyStatus } from "../hooks/useKeyStatus";
import { ApiDisabledModal } from "./ApiDisabledModal";
import type { Provider } from "../types";
import { useI18n } from "../i18n";

type ProviderAvailability = {
  ok: boolean;
  reason: string;
  hint?: string;
};

export function useProviderAvailability(): Record<Provider, ProviderAvailability> {
  const { t } = useI18n();
  const oauth = useOAuthStatus();
  const { data } = useBilling();
  const grok = useGrokStatus();
  const { data: keyStatus } = useKeyStatus();

  const oauthReady = oauth?.status === "ready";
  let oauthReason = t("provider.oauthNotReady");
  let oauthHint: string | undefined;
  if (oauth?.status === "auth_required") {
    oauthReason = t("provider.codexLoginRequired");
    oauthHint = t("provider.codexLoginHint");
  } else if (oauth?.status === "starting") {
    oauthReason = t("provider.oauthStarting");
  } else if (!oauth) {
    oauthReason = t("provider.serverUnreachable");
  }

  const apiOk = data?.apiKeyValid === true;

  const grokReady = grok?.status === "ready";
  const grokReason = !grok
    ? t("provider.grokNotReady")
    : grok.status === "offline"
      ? t("provider.grokOffline")
      : grok.status === "no_image_model"
        ? t("provider.grokNoImageModel")
        : grok.status === "error"
          ? t("provider.grokNotReady")
          : "";

  const xaiKeyOk = keyStatus?.xai?.valid === true;
  const geminiKeyOk = keyStatus?.gemini?.valid === true || keyStatus?.vertex?.valid === true;
  const atlasCloudKeyOk = keyStatus?.atlascloud?.valid === true;

  return {
    oauth: { ok: oauthReady, reason: oauthReason, hint: oauthHint },
    api: {
      ok: apiOk,
      reason: apiOk ? "" : t("provider.apiInvalid"),
    },
    grok: {
      ok: grokReady,
      reason: grokReason,
      hint: grokReady ? undefined : t("provider.grokOfflineHint"),
    },
    "grok-api": {
      ok: xaiKeyOk,
      reason: xaiKeyOk ? "" : t("provider.xaiApiKeyRequired"),
    },
    agy: {
      ok: true,
      reason: "",
    },
    "gemini-api": {
      ok: geminiKeyOk,
      reason: geminiKeyOk ? "" : t("provider.geminiApiKeyRequired"),
    },
    atlascloud: {
      ok: atlasCloudKeyOk,
      reason: atlasCloudKeyOk ? "" : t("provider.atlasCloudApiKeyRequired"),
    },
  };
}

type ProviderSelectProps = {
  allowGrok?: boolean;
};

type CellDef = {
  value: Provider;
  label: string;
  disabled?: boolean;
};

const GRID: { header: string; cells: CellDef[] }[] = [
  {
    header: "GPT",
    cells: [
      { value: "oauth", label: "OAuth" },
      { value: "api", label: "API" },
    ],
  },
  {
    header: "Grok",
    cells: [
      { value: "grok", label: "OAuth" },
      { value: "grok-api", label: "API" },
    ],
  },
  {
    header: "Gemini",
    cells: [
      { value: "agy", label: "agy" },
      { value: "gemini-api", label: "API" },
    ],
  },
  {
    header: "Atlas",
    cells: [
      { value: "atlascloud", label: "API" },
    ],
  },
];

export function ProviderSelect({ allowGrok = true }: ProviderSelectProps) {
  const { t } = useI18n();
  const provider = useAppStore((s) => s.provider);
  const setProvider = useAppStore((s) => s.setProvider);
  const availability = useProviderAvailability();
  const [blocked, setBlocked] = useState<Provider | null>(null);

  const providerAvailability = {
    ...availability,
    grok: allowGrok
      ? availability.grok
      : { ok: false, reason: t("provider.grokClassicOnly"), hint: t("provider.grokClassicOnlyHint") },
  };

  const handleClick = (cell: CellDef) => {
    if (cell.disabled) return;
    if (providerAvailability[cell.value].ok) {
      setProvider(cell.value);
    } else {
      setBlocked(cell.value);
    }
  };

  const blockedLabel = blocked
    ? GRID.flatMap((col) => col.cells).find((c) => c.value === blocked)?.label ?? ""
    : "";
  const blockedInfo = blocked
    ? { label: blockedLabel, ...providerAvailability[blocked] }
    : null;

  return (
    <>
      <div className="section-title">{t("provider.authTitle")}</div>
      <div className="provider-grid">
        {GRID.map((col) => (
          <div key={col.header} className="provider-grid__col">
            <div className="provider-grid__header">{col.header}</div>
            {col.cells.map((cell, i) => {
              const selected = !cell.disabled && provider === cell.value;
              const ok = cell.disabled ? false : providerAvailability[cell.value].ok;
              const label = `${col.header} ${cell.label}`;
              return (
                <button
                  key={`${col.header}-${i}`}
                  type="button"
                  className={`provider-pill${selected ? " selected" : ""}${cell.disabled ? " disabled" : ""}`}
                  onClick={() => handleClick(cell)}
                  disabled={cell.disabled}
                  title={cell.disabled ? t("provider.comingSoon") : ok ? label : providerAvailability[cell.value].reason}
                  aria-label={cell.disabled ? `${label} (coming soon)` : ok ? t("provider.availableAria", { name: label }) : t("provider.unavailableAria", { name: label })}
                  aria-pressed={selected}
                >
                  {!cell.disabled && (
                    <span
                      className={`status-dot ${ok ? "status-dot--ok" : "status-dot--bad"}`}
                      aria-hidden="true"
                    />
                  )}
                  <span>{cell.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <ApiDisabledModal
        open={!!blockedInfo}
        providerLabel={blockedInfo?.label ?? ""}
        reason={blockedInfo?.reason ?? ""}
        hint={blockedInfo?.hint}
        onClose={() => setBlocked(null)}
      />
    </>
  );
}
