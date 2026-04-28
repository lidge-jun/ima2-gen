import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";
import { useIsMobile } from "../hooks/useIsMobile";
import { SidebarStack } from "./Sidebar";
import { ENABLE_CARD_NEWS_MODE, ENABLE_NODE_MODE } from "../lib/devMode";

export function MobileComposeSheet() {
  const { t } = useI18n();
  const open = useAppStore((s) => s.composeSheetOpen);
  const close = useAppStore((s) => s.closeComposeSheet);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const uiModeRaw = useAppStore((s) => s.uiMode);
  const uiMode =
    uiModeRaw === "card-news" && ENABLE_CARD_NEWS_MODE ? "card-news" :
      uiModeRaw === "node" && ENABLE_NODE_MODE ? "node" :
        "classic";
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!isMobile || settingsOpen || uiMode !== "classic") return null;

  return (
    <>
      {open ? (
        <div
          className="compose-sheet-backdrop"
          role="button"
          aria-label={t("sheet.close")}
          onClick={close}
        />
      ) : null}
      <section
        className={`compose-sheet${open ? " compose-sheet--open" : ""}`}
        role="dialog"
        aria-modal={open ? "true" : "false"}
        aria-label={t("sheet.compose")}
        aria-hidden={!open}
      >
        <button
          type="button"
          className="compose-sheet__handle"
          onClick={close}
          aria-label={t("sheet.close")}
        />
        <div className="compose-sheet__body">
          <SidebarStack />
        </div>
      </section>
    </>
  );
}
