import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { useOAuthStatus } from "../hooks/useOAuthStatus";
import { useBilling } from "../hooks/useBilling";
import { ApiDisabledModal } from "./ApiDisabledModal";
import type { Provider } from "../types";

type ProviderAvailability = {
  ok: boolean;
  reason: string;
  hint?: string;
};

function useProviderAvailability(): Record<Provider, ProviderAvailability> {
  const oauth = useOAuthStatus();
  const { data } = useBilling();

  const oauthReady = oauth?.status === "ready";
  let oauthReason = "OAuth 프록시가 아직 준비되지 않았습니다.";
  let oauthHint: string | undefined;
  if (oauth?.status === "auth_required") {
    oauthReason = "Codex 로그인이 필요합니다.";
    oauthHint = "터미널에서 `codex login`을 실행한 뒤 이 페이지를 새로고침하세요.";
  } else if (oauth?.status === "starting") {
    oauthReason = "OAuth 프록시가 시작 중입니다. 몇 초 후 다시 시도하세요.";
  } else if (!oauth) {
    oauthReason = "서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인하세요.";
  }

  const apiOk = data?.apiKeyValid === true;

  return {
    oauth: { ok: oauthReady, reason: oauthReason, hint: oauthHint },
    api: {
      ok: apiOk,
      reason: apiOk
        ? ""
        : "API 키가 없거나 유효하지 않습니다. 서버의 .env 파일에서 OPENAI_API_KEY를 확인하세요.",
    },
  };
}

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "oauth", label: "OAuth" },
  { value: "api", label: "API 키" },
];

export function ProviderSelect() {
  const provider = useAppStore((s) => s.provider);
  const setProvider = useAppStore((s) => s.setProvider);
  const availability = useProviderAvailability();
  const [blocked, setBlocked] = useState<Provider | null>(null);

  const handleClick = (p: Provider) => {
    if (availability[p].ok) {
      setProvider(p);
    } else {
      setBlocked(p);
    }
  };

  const blockedInfo = blocked
    ? { label: PROVIDERS.find((x) => x.value === blocked)!.label, ...availability[blocked] }
    : null;

  return (
    <>
      <div className="section-title">인증 방식</div>
      <div className="provider-row">
        {PROVIDERS.map((p) => {
          const selected = provider === p.value;
          const ok = availability[p.value].ok;
          return (
            <button
              key={p.value}
              type="button"
              className={`provider-pill${selected ? " selected" : ""}`}
              onClick={() => handleClick(p.value)}
              title={ok ? `${p.label} 사용 가능` : availability[p.value].reason}
              aria-label={`${p.label}: ${ok ? "사용 가능" : "사용 불가"}`}
              aria-pressed={selected}
            >
              <span
                className={`status-dot ${ok ? "status-dot--ok" : "status-dot--bad"}`}
                aria-hidden="true"
              />
              <span>{p.label}</span>
              <span className="sr-only">{ok ? "(사용 가능)" : "(사용 불가)"}</span>
            </button>
          );
        })}
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
