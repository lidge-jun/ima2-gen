import { ProviderSelect } from "./ProviderSelect";
import { UIModeSwitch } from "./UIModeSwitch";
import { PromptComposer } from "./PromptComposer";
import { GenerateButton } from "./GenerateButton";
import { InFlightList } from "./InFlightList";
import { HistoryStrip } from "./HistoryStrip";
import { SessionPicker } from "./SessionPicker";
import { useAppStore } from "../store/useAppStore";
import { ENABLE_NODE_MODE } from "../lib/devMode";

export function Sidebar() {
  const uiModeRaw = useAppStore((s) => s.uiMode);
  const uiMode = ENABLE_NODE_MODE ? uiModeRaw : "classic";
  const openLogModal = useAppStore((s) => s.openLogModal);
  return (
    <aside className="sidebar">
      <div className="sidebar__scroll">
        <div className="logo" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="logo-dot" />
          <span style={{ flex: 1 }}>이미지 생성기</span>
          <span className="logo-badge">GPT 이미지</span>
          <button
            type="button"
            onClick={openLogModal}
            title="생성 로그 (재시도 이력)"
            aria-label="생성 로그"
            style={{
              marginLeft: 4,
              padding: "2px 8px",
              fontSize: 12,
              border: "1px solid var(--line, #2a2a2a)",
              borderRadius: 6,
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            로그
          </button>
        </div>
        <UIModeSwitch />
        {uiMode === "classic" ? (
          <>
            <ProviderSelect />
            <PromptComposer />
            <GenerateButton />
            <InFlightList />
          </>
        ) : (
          <>
            <SessionPicker />
            <div className="sidebar__node-hint">
              노드 모드에서는 노드를 눌러 프롬프트를 수정한 뒤 생성하세요. 오른쪽 패널의 설정
              (품질/크기)은 새로 만드는 모든 결과에 적용됩니다.
            </div>
            <InFlightList />
          </>
        )}
      </div>
      <HistoryStrip />
    </aside>
  );
}
