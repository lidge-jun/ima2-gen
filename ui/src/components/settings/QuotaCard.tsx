import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n";

interface QuotaWindow {
  label: string;
  percent: number;
  resetsAt: string | null;
}

interface QuotaResult {
  provider: string;
  account?: { email: string | null; plan: string | null } | null;
  windows: QuotaWindow[];
  error?: boolean;
  authenticated?: boolean;
  billing?: { usedUsd: number; limitUsd: number };
}

interface QuotaResponse {
  codex?: QuotaResult;
  grok?: QuotaResult;
}

interface SwitchState {
  phase: "idle" | "starting" | "waiting" | "complete" | "error";
  userCode?: string;
  verificationUrl?: string;
  sessionId?: string;
  error?: string;
}

function barColor(pct: number): string {
  if (pct > 80) return "var(--red)";
  if (pct > 50) return "var(--amber)";
  return "var(--blue)";
}

function formatReset(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function QuotaBar({ window: w }: { window: QuotaWindow }) {
  const reset = formatReset(w.resetsAt);
  return (
    <div className="quota-bar">
      <span className="quota-bar__label">{w.label}</span>
      <div className="quota-bar__track">
        <div
          className="quota-bar__fill"
          style={{ width: `${Math.min(w.percent, 100)}%`, background: barColor(w.percent) }}
        />
      </div>
      <span className="quota-bar__pct">{w.percent}%</span>
      {reset && <span className="quota-bar__reset">{reset}</span>}
    </div>
  );
}

function SwitchAccountButton({ provider, onComplete }: { provider: "grok" | "codex"; onComplete: () => void }) {
  const { t } = useI18n();
  const [state, setState] = useState<SwitchState>({ phase: "idle" });
  const [copied, setCopied] = useState(false);
  const switching = useRef(false);

  const startSwitch = useCallback(async () => {
    if (switching.current) return;
    switching.current = true;
    setState({ phase: "starting" });
    try {
      const res = await fetch("/api/auth/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: t("settings.quota.switchFailed") })) as { error?: string };
        setState({ phase: "error", error: err.error || `HTTP ${res.status}` });
        return;
      }
      const data = await res.json() as { sessionId: string; userCode: string; verificationUrl: string };
      setState({ phase: "waiting", ...data });
      window.open(data.verificationUrl, "_blank");
    } catch (e) {
      switching.current = false;
      setState({ phase: "error", error: (e as Error).message });
    }
  }, [provider]);

  useEffect(() => {
    if (state.phase !== "waiting" || !state.sessionId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/auth/switch/${state.sessionId}`);
        const data = await res.json() as { status: string; error?: string };
        if (cancelled) return;
        if (data.status === "complete") {
          setState({ phase: "complete" });
          setTimeout(onComplete, 1000);
          return;
        }
        if (data.status === "error" || data.status === "expired") {
          setState({ phase: "error", error: data.error || data.status });
          return;
        }
      } catch { /* retry */ }
      if (!cancelled) setTimeout(poll, 3000);
    };
    const timer = setTimeout(poll, 3000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [state.phase, state.sessionId, onComplete]);

  if (state.phase === "idle") {
    return (
      <button
        type="button"
        className="settings-action-btn"
        style={{ width: "100%", marginTop: "6px" }}
        onClick={startSwitch}
      >
        {t("settings.quota.switchAccount", { provider: provider === "grok" ? "Grok" : "Codex" })}
      </button>
    );
  }

  if (state.phase === "starting") {
    return (
      <div className="quota-card__hint" style={{ textAlign: "center", marginTop: "6px" }}>
        {t("settings.quota.startingLogin")}
      </div>
    );
  }

  if (state.phase === "waiting") {
    return (
      <div style={{ marginTop: "6px", padding: "8px", background: "var(--surface, #f5f5f5)", borderRadius: "var(--r-sm)", fontSize: "12px" }}>
        <div style={{ textAlign: "center", marginBottom: "4px" }}>
          {t("settings.quota.enterCode")}
        </div>
        <div style={{ textAlign: "center", fontSize: "18px", fontWeight: 700, fontFamily: "monospace", letterSpacing: "2px", margin: "6px 0" }}>
          {state.userCode}
        </div>
        {state.verificationUrl && (
          <div style={{ display: "flex", gap: "4px", margin: "6px 0" }}>
            <button
              type="button"
              className="settings-action-btn"
              style={{ flex: 1, fontSize: "11px" }}
              onClick={() => { switching.current = false; startSwitch(); }}
            >
              {t("settings.quota.retry")}
            </button>
            <button
              type="button"
              className="settings-action-btn"
              style={{ flex: 1, fontSize: "11px" }}
              onClick={() => {
                navigator.clipboard?.writeText(state.verificationUrl!).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
              }}
            >
              {copied ? t("settings.quota.copied") : t("settings.quota.copyLink")}
            </button>
          </div>
        )}
        <div style={{ textAlign: "center", color: "var(--text-dim, #888)", fontSize: "11px" }}>
          {t("settings.quota.waitingApproval")}
        </div>
      </div>
    );
  }

  if (state.phase === "complete") {
    return (
      <div className="quota-card__hint" style={{ textAlign: "center", marginTop: "6px", color: "var(--green)" }}>
        {t("settings.quota.switchComplete")}
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div style={{ marginTop: "6px" }}>
        <div className="quota-card__hint" style={{ color: "var(--red)", marginBottom: "4px" }}>
          {state.error || t("settings.quota.switchFailed")}
        </div>
        <button
          type="button"
          className="settings-action-btn"
          style={{ width: "100%", fontSize: "11px" }}
          onClick={() => { switching.current = false; setState({ phase: "idle" }); }}
        >
          {t("settings.quota.tryAgain")}
        </button>
      </div>
    );
  }

  return null;
}

/** Shared quota fetch — call once in the parent and pass results down. */
export function useQuotaData() {
  const [data, setData] = useState<QuotaResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshQuota = useCallback(() => {
    setLoading(true);
    fetch("/api/quota")
      .then((r) => r.json() as Promise<QuotaResponse>)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(refreshQuota, 1500);
    return () => clearTimeout(timer);
  }, [refreshQuota]);

  return { data, loading, refreshQuota };
}

type QuotaBlockProps = {
  data: QuotaResponse | null;
  loading: boolean;
  onRefresh: () => void;
};

/** Codex rate-limit block — lives inside the GPT OAuth provider card. */
export function CodexQuota({ data, loading, onRefresh }: QuotaBlockProps) {
  const { t } = useI18n();
  const codex = data?.codex;
  const hasCodexWindows = codex?.windows && codex.windows.length > 0;
  const accountLine = codex?.account
    ? [codex.account.email, codex.account.plan].filter(Boolean).join(" · ")
    : null;

  return (
    <div className="quota-card">
      {accountLine ? (
        <div className="quota-card__header">
          <span className="quota-card__account">{accountLine}</span>
        </div>
      ) : null}
      {loading ? (
        <span className="quota-card__loading">{t("common.loading")}</span>
      ) : hasCodexWindows ? (
        codex!.windows.map((w) => <QuotaBar key={w.label} window={w} />)
      ) : codex?.authenticated === false ? (
        <span className="quota-card__hint">{t("settings.quota.codexNotLoggedIn")}</span>
      ) : codex?.error ? (
        <span className="quota-card__hint">{t("settings.quota.fetchError")}</span>
      ) : (
        <span className="quota-card__hint">{t("settings.quota.noData")}</span>
      )}
      <SwitchAccountButton provider="codex" onComplete={onRefresh} />
    </div>
  );
}

/** Grok quota block — lives inside the Grok provider card. */
export function GrokQuota({ data, loading, onRefresh }: QuotaBlockProps) {
  const { t } = useI18n();
  const grok = data?.grok;
  const hasGrokWindows = grok?.windows && grok.windows.length > 0;
  const grokAccountLine = grok?.account
    ? [grok.account.email, grok.account.plan].filter(Boolean).join(" · ")
    : null;

  return (
    <div className="quota-card">
      {grokAccountLine || grok?.billing ? (
        <div className="quota-card__header" style={{ display: "flex", alignItems: "center" }}>
          {grokAccountLine && <span className="quota-card__account">{grokAccountLine}</span>}
          {grok?.billing && (
            <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--text-dim, #888)", whiteSpace: "nowrap" }}>
              ${grok.billing.usedUsd.toFixed(1)}/${grok.billing.limitUsd}
            </span>
          )}
        </div>
      ) : null}
      {loading ? (
        <span className="quota-card__loading">{t("common.loading")}</span>
      ) : hasGrokWindows ? (
        grok!.windows.map((w) => <QuotaBar key={w.label} window={w} />)
      ) : grok?.authenticated === false ? (
        <span className="quota-card__hint">{t("settings.quota.codexNotLoggedIn")}</span>
      ) : (
        <a
          href="https://grok.com/?_s=usage"
          target="_blank"
          rel="noopener noreferrer"
          className="settings-action-btn"
        >
          {t("settings.quota.grokUsageLink")}
        </a>
      )}
      <SwitchAccountButton provider="grok" onComplete={onRefresh} />
    </div>
  );
}
