import { useOAuthStatus } from "../hooks/useOAuthStatus";

type Tone = "ok" | "warn" | "bad";

type StatusView = {
  tone: Tone;
  title: string;
  hint?: string;
};

function viewForStatus(status: string | undefined): StatusView {
  switch (status) {
    case "ready":
      return { tone: "ok", title: "OAuth 연결됨", hint: "ChatGPT 세션으로 생성합니다" };
    case "starting":
      return { tone: "warn", title: "OAuth 준비 중", hint: "몇 초만 기다려 주세요…" };
    case "auth_required":
      return {
        tone: "bad",
        title: "로그인이 필요합니다",
        hint: "터미널에서 'codex login' 실행 후 새로고침",
      };
    case "offline":
      return {
        tone: "bad",
        title: "OAuth 프록시 오프라인",
        hint: "서버를 다시 시작해 보세요",
      };
    default:
      return {
        tone: "warn",
        title: "상태 확인 중",
        hint: "백엔드 응답을 기다리고 있어요",
      };
  }
}

export function ProviderSelect() {
  const oauth = useOAuthStatus();
  const view = viewForStatus(oauth?.status);

  return (
    <div
      className={`auth-status auth-status--${view.tone}`}
      role="status"
      aria-label={view.title}
    >
      <div className="auth-status__head">
        <span className={`status-dot status-dot--${view.tone === "ok" ? "ok" : "bad"}`} aria-hidden="true" />
        <span className="auth-status__title">{view.title}</span>
      </div>
      {view.hint && <div className="auth-status__hint">{view.hint}</div>}
    </div>
  );
}
