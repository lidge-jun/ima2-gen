import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { BillingBar } from "./BillingBar";
import { OptionGroup } from "./OptionGroup";
import { SizePicker } from "./SizePicker";
import { CostEstimate } from "./CostEstimate";
import type { Count, Format, Quality } from "../types";

const QUALITY_ITEMS = [
  { value: "low" as const, label: "낮음", sub: "~10–20초" },
  { value: "medium" as const, label: "중간", sub: "~20–40초" },
  { value: "high" as const, label: "높음", sub: "~40–80초" },
];

const FORMAT_ITEMS = [
  { value: "png" as const, label: "PNG", sub: "투명 지원" },
  { value: "jpeg" as const, label: "JPEG", sub: "작은 용량" },
  { value: "webp" as const, label: "WebP", sub: "균형" },
];

const MOD_ITEMS = [
  { value: "auto" as const, label: "표준", sub: "기본값" },
  {
    value: "low" as const,
    label: "완화",
    sub: "경계선 허용",
    color: "var(--amber)",
  },
];

const COUNT_ITEMS: { value: string; label: string; sub?: string }[] = [
  { value: "1", label: "1", sub: "기본" },
  { value: "2", label: "2", sub: "×2 비용" },
  { value: "4", label: "4", sub: "×4 비용" },
];

function ModerationHelp() {
  return (
    <span
      className="option-help-icon"
      title="표준은 기본 안전 필터를, 완화는 경계선 프롬프트를 조금 더 허용합니다. 유해 콘텐츠 필터는 두 모드 모두에서 유지됩니다."
      aria-label="모더레이션 안내"
    >
      ?
    </span>
  );
}

export function RightPanel() {
  const open = useAppStore((s) => s.rightPanelOpen);
  const toggle = useAppStore((s) => s.toggleRightPanel);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.matchMedia("(max-width: 800px)").matches : false,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 800px)");
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const drawerOpen = isMobile ? open : true;

  const quality = useAppStore((s) => s.quality);
  const setQuality = useAppStore((s) => s.setQuality);
  const format = useAppStore((s) => s.format);
  const setFormat = useAppStore((s) => s.setFormat);
  const moderation = useAppStore((s) => s.moderation);
  const setModeration = useAppStore((s) => s.setModeration);
  const count = useAppStore((s) => s.count);
  const setCount = useAppStore((s) => s.setCount);

  return (
    <>
      {isMobile && open ? (
        <div
          className="right-panel-backdrop"
          role="button"
          aria-label="설정 닫기"
          onClick={toggle}
        />
      ) : null}
      <aside
        className={`right-panel${open ? "" : " collapsed"}${isMobile && drawerOpen ? " drawer-open" : ""}`}
        aria-label="세부 설정"
      >
        <button
          type="button"
          className="right-panel-toggle"
          aria-expanded={open}
          aria-controls="right-panel-body"
          onClick={toggle}
          title={open ? "설정 숨기기" : "설정 보기"}
        >
          {isMobile ? (
            <span>{open ? "닫기" : "설정"}</span>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points={open ? "9 18 15 12 9 6" : "15 18 9 12 15 6"} />
            </svg>
          )}
        </button>
        <div
          id="right-panel-body"
          className="right-panel-body"
          hidden={!open}
        >
          <BillingBar />
          <OptionGroup<Quality>
            title="품질"
            items={QUALITY_ITEMS}
            value={quality}
            onChange={setQuality}
          />
          <SizePicker />
          <OptionGroup<Format>
            title="포맷"
            items={FORMAT_ITEMS}
            value={format}
            onChange={setFormat}
          />
          <div className="option-group">
            <div className="section-title option-title-with-help">
              모더레이션
              <ModerationHelp />
            </div>
            <div className="option-row">
              {MOD_ITEMS.map((it) => (
                <button
                  key={it.value}
                  className={`option-btn${it.value === moderation ? " active" : ""}`}
                  style={it.color ? { color: it.color } : undefined}
                  onClick={() => setModeration(it.value)}
                  type="button"
                >
                  {it.label}
                  {it.sub ? (
                    <>
                      <br />
                      <span className="option-sub">{it.sub}</span>
                    </>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
          <OptionGroup<string>
            title="개수"
            items={COUNT_ITEMS}
            value={String(count)}
            onChange={(v) => setCount(Number(v) as Count)}
          />
          <CostEstimate />
        </div>
      </aside>
    </>
  );
}
