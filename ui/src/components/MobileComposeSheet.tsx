import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";
import { useIsMobile } from "../hooks/useIsMobile";
import { PromptComposer } from "./PromptComposer";
import { GenerateButton } from "./GenerateButton";
import { InFlightList } from "./InFlightList";
import { InFlightBadge } from "./composer/InFlightBadge";
import { GenerationControlsPanel } from "./GenerationControlsPanel";
import { ENABLE_AGENT_MODE, ENABLE_CARD_NEWS_MODE, ENABLE_NODE_MODE } from "../lib/devMode";
import type { ComposeSheetTab } from "../store/useAppStore";
import {
  clearMobileComposeSheetOpener,
  restoreMobileComposeSheetOpener,
} from "../lib/mobileComposeSheetFocus";

const LazyPromptLibraryPanel = lazy(() =>
  import("./PromptLibraryPanel").then((module) => ({ default: module.PromptLibraryPanel })),
);

const SHEET_TABS: ComposeSheetTab[] = ["prompt", "controls", "library"];
const MOBILE_INFLIGHT_PANEL_ID = "mobile-inflight-panel";
const tabId = (tab: ComposeSheetTab) => `mobile-sheet-tab-${tab}`;
const panelId = (tab: ComposeSheetTab) => `mobile-sheet-panel-${tab}`;

export function MobileComposeSheet() {
  const { t } = useI18n();
  const open = useAppStore((s) => s.composeSheetOpen);
  const activeTab = useAppStore((s) => s.composeSheetTab);
  const setActiveTab = useAppStore((s) => s.setComposeSheetTab);
  const close = useAppStore((s) => s.closeComposeSheet);
  const inFlightCount = useAppStore((s) => s.inFlight.length);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const uiModeRaw = useAppStore((s) => s.uiMode);
  const uiMode =
    uiModeRaw === "agent" && ENABLE_AGENT_MODE ? "agent" :
      uiModeRaw === "card-news" && ENABLE_CARD_NEWS_MODE ? "card-news" :
      uiModeRaw === "node" && ENABLE_NODE_MODE ? "node" :
      uiModeRaw === "home" ? "home" :
      uiModeRaw === "assets" ? "assets" :
        "classic";
  const isMobile = useIsMobile();
  const [inflightExpanded, setInflightExpanded] = useState(false);
  const previousInFlightCountRef = useRef(inFlightCount);
  const inflightHadFocusRef = useRef(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<ComposeSheetTab, HTMLButtonElement | null>>>({});
  const wasOpenRef = useRef(false);

  const focusTab = (tab: ComposeSheetTab) => {
    setActiveTab(tab);
    requestAnimationFrame(() => tabRefs.current[tab]?.focus());
  };
  const onTabKeyDown = (event: React.KeyboardEvent, current: ComposeSheetTab) => {
    const index = SHEET_TABS.indexOf(current);
    const target =
      event.key === "ArrowRight" ? SHEET_TABS[(index + 1) % SHEET_TABS.length] :
        event.key === "ArrowLeft" ? SHEET_TABS[(index - 1 + SHEET_TABS.length) % SHEET_TABS.length] :
          event.key === "Home" ? SHEET_TABS[0] :
            event.key === "End" ? SHEET_TABS[SHEET_TABS.length - 1] : null;
    if (!target) return;
    event.preventDefault();
    focusTab(target);
  };

  useEffect(() => {
    if (!open || activeTab !== "prompt" || !isMobile || settingsOpen || uiMode !== "classic") {
      setInflightExpanded(false);
    }
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, activeTab, close, isMobile, settingsOpen, uiMode]);

  useLayoutEffect(() => {
    const lastJobFinished = previousInFlightCountRef.current > 0 && inFlightCount === 0;
    previousInFlightCountRef.current = inFlightCount;
    if (!lastJobFinished) return;
    setInflightExpanded(false);
    if (inflightHadFocusRef.current) {
      actionsRef.current?.querySelector<HTMLButtonElement>(".generate-btn")?.focus();
    }
    inflightHadFocusRef.current = false;
  }, [inFlightCount]);

  useLayoutEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      const frame = requestAnimationFrame(() => tabRefs.current[activeTab]?.focus());
      return () => cancelAnimationFrame(frame);
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      restoreMobileComposeSheetOpener();
    }
  }, [open, activeTab]);

  const rendered = isMobile && !settingsOpen && uiMode === "classic";
  useEffect(() => {
    if (!rendered) {
      wasOpenRef.current = false;
      if (useAppStore.getState().composeSheetOpen) close();
      clearMobileComposeSheetOpener();
    }
  }, [rendered]);

  useEffect(() => () => clearMobileComposeSheetOpener(), []);

  if (!rendered) return null;

  return (
    <>
      {open ? (
        <button
          type="button"
          className="compose-sheet-backdrop"
          aria-label={t("sheet.close")}
          onClick={close}
        />
      ) : null}
      <section
        id="mobile-generate-sheet"
        inert={!open}
        className={`compose-sheet${open ? " compose-sheet--open" : ""}`}
        role="dialog"
        aria-modal={open ? "true" : "false"}
        aria-label={t("sheet.generate")}
        aria-hidden={!open}
      >
        <button
          type="button"
          className="compose-sheet__handle"
          onClick={close}
          aria-label={t("sheet.close")}
        />
        <div className="mobile-sheet-tabs" role="tablist" aria-label={t("sheet.generate")}>
          {SHEET_TABS.map((tab) => (
            <button
              ref={(node) => { tabRefs.current[tab] = node; }}
              key={tab}
              id={tabId(tab)}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={panelId(tab)}
              tabIndex={activeTab === tab ? 0 : -1}
              className={`mobile-sheet-tabs__button${activeTab === tab ? " active" : ""}`}
              onClick={() => setActiveTab(tab)}
              onKeyDown={(event) => onTabKeyDown(event, tab)}
            >
              {t(`sheet.tabs.${tab}`)}
            </button>
          ))}
        </div>
        <div className="compose-sheet__body">
          <div
            id={panelId("prompt")}
            className="compose-sheet__panel compose-sheet__panel--prompt"
            role="tabpanel"
            aria-labelledby={tabId("prompt")}
            hidden={activeTab !== "prompt"}
            onFocusCapture={(event) => {
              const panel = document.getElementById(MOBILE_INFLIGHT_PANEL_ID);
              inflightHadFocusRef.current = panel?.contains(event.target as Node) ?? false;
            }}
          >
            {activeTab === "prompt" ? <>
              <PromptComposer />
              {inFlightCount > 0 ? (
                <section className="compose-sheet__inflight" hidden={!inflightExpanded}>
                  <button
                    type="button"
                    className="compose-sheet__inflight-header"
                    onClick={() => {
                      actionsRef.current?.querySelector<HTMLButtonElement>(".inflight-badge")?.focus();
                      setInflightExpanded(false);
                    }}
                    aria-expanded={inflightExpanded}
                    aria-controls={MOBILE_INFLIGHT_PANEL_ID}
                    aria-label={t("inflight.inlineCollapse", { n: inFlightCount })}
                  >
                    <span>{t("inflight.title")} ({inFlightCount})</span>
                    <span aria-hidden="true">−</span>
                  </button>
                  <InFlightList variant="inline" panelId={MOBILE_INFLIGHT_PANEL_ID} />
                  <p className="compose-sheet__inflight-footer">{t("inflight.footerHint")}</p>
                </section>
              ) : null}
              <div ref={actionsRef} className="compose-sheet__actions">
                <GenerateButton />
                <InFlightBadge
                  variant="inline"
                  panelId={MOBILE_INFLIGHT_PANEL_ID}
                  expanded={inflightExpanded}
                  onToggle={setInflightExpanded}
                />
              </div>
            </> : null}
          </div>
          <div
            id={panelId("controls")}
            className="compose-sheet__panel compose-sheet__panel--controls"
            role="tabpanel"
            aria-labelledby={tabId("controls")}
            hidden={activeTab !== "controls"}
          >
            {activeTab === "controls" ? <GenerationControlsPanel /> : null}
          </div>
          <div
            id={panelId("library")}
            className="compose-sheet__panel compose-sheet__panel--library"
            role="tabpanel"
            aria-labelledby={tabId("library")}
            hidden={activeTab !== "library"}
          >
            {activeTab === "library" ? (
              <Suspense fallback={<div className="prompt-library-panel__loading">{t("common.loading")}</div>}>
                <LazyPromptLibraryPanel
                  variant="embedded"
                  forceOpen
                  onRequestClose={() => setActiveTab("prompt")}
                />
              </Suspense>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
