import { ProviderSelect } from "./ProviderSelect";
import { UIModeSwitch } from "./UIModeSwitch";
import { PromptComposer } from "./PromptComposer";
import { GenerateButton } from "./GenerateButton";
import { InFlightList } from "./InFlightList";
import { HistoryStrip } from "./HistoryStrip";
import { SessionPicker } from "./SessionPicker";
import { useAppStore } from "../store/useAppStore";
import { IS_DEV_UI } from "../lib/devMode";

export function Sidebar() {
  const uiModeRaw = useAppStore((s) => s.uiMode);
  const uiMode = IS_DEV_UI ? uiModeRaw : "classic";
  return (
    <aside className="sidebar">
      <div className="sidebar__scroll">
        <div className="logo">
          <div className="logo-dot" />
          이미지 생성기
          <span className="logo-badge">gpt-image-2</span>
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
