import { useMemo, type ReactNode } from "react";
import { useI18n } from "../../i18n";
import { useAppStore } from "../../store/useAppStore";
import { useProviderAvailability } from "../../hooks/useProviderAvailability";
import { ENABLE_AGENT_MODE, ENABLE_NODE_MODE } from "../../lib/devMode";
import type { UIMode } from "../../types";
import {
  IconAgent,
  IconAssets,
  IconCreate,
  IconNode,
  MODE_TO_HASH,
} from "../NavRail";
import { HomePromptComposer } from "./HomePromptComposer";
import { HomeRecentRow } from "./HomeRecentRow";

/**
 * Home's opening frame.
 *
 * This is a tool people open every day, not a landing page, so the hero does
 * not put a slogan in front of the work. It states what the product is in two
 * lines, shows how many generation lanes are actually reachable right now, and
 * hands the screen to the prompt composer that follows it. The oversized IMA2
 * wordmark sits behind everything as a background layer — it used to be a
 * decoration stranded below the fold.
 */

function ArrowIcon() {
  return (
    <svg
      className="home-hero__mode-arrow"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

export function HomeHero() {
  const { t } = useI18n();
  const availability = useProviderAvailability();

  // Readiness is a fact about this machine, not a feature list: it answers
  // "can I generate right now" before the user types anything.
  const readyLanes = useMemo(
    () => Object.values(availability).filter((lane) => lane?.ok).length,
    [availability],
  );
  const totalLanes = useMemo(() => Object.keys(availability).length, [availability]);

  return (
    <div className="home-hero">
      <div className="home-hero__mark" aria-hidden="true">
        IMA2
      </div>

      <header className="home-hero__intro">
        <h1 className="home-hero__title">{t("home.heroTitle")}</h1>
        <p className="home-hero__lede">{t("home.heroLede")}</p>
      </header>

      <p className="home-hero__readiness" role="status">
        <span
          className={`home-hero__dot${readyLanes > 0 ? " is-ready" : ""}`}
          aria-hidden="true"
        />
        {readyLanes > 0
          ? t("home.lanesReady", { ready: readyLanes, total: totalLanes })
          : t("home.lanesNone")}
      </p>

      <div className="home-workspace__composer">
        <HomePromptComposer providerAvailability={availability} />
      </div>

      <section className="home-workspace__recent" aria-labelledby="home-recent-title">
        <h2 id="home-recent-title">{t("home.recentTitle")}</h2>
        <HomeRecentRow />
      </section>

      <HomeModeRoster />
    </div>
  );
}

/**
 * Secondary navigation, deliberately below the composer and the recent work.
 * Rendered as an index rather than four equal cards so it reads as a list of
 * places to go, not as a feature grid competing with Generate.
 */
export function HomeModeRoster() {
  const { t } = useI18n();
  const setUIMode = useAppStore((state) => state.setUIMode);
  const modes: ReadonlyArray<{
    mode: UIMode;
    label: string;
    hint: string;
    enabled: boolean;
    icon: () => ReactNode;
  }> = [
    { mode: "classic", label: t("nav.create"), hint: t("home.modeCreateHint"), enabled: true, icon: IconCreate },
    { mode: "node", label: t("nav.node"), hint: t("home.modeNodeHint"), enabled: ENABLE_NODE_MODE, icon: IconNode },
    { mode: "agent", label: t("nav.agent"), hint: t("home.modeAgentHint"), enabled: ENABLE_AGENT_MODE, icon: IconAgent },
    { mode: "assets", label: t("nav.assets"), hint: t("home.modeAssetsHint"), enabled: true, icon: IconAssets },
  ];

  function goToMode(mode: UIMode) {
    setUIMode(mode);
    history.replaceState(null, "", MODE_TO_HASH[mode] ?? "#create");
  }

  return (
    <nav className="home-modes" aria-label={t("home.modesTitle")}>
      <h2 className="home-modes__title">{t("home.modesTitle")}</h2>
      {modes.filter((entry) => entry.enabled).map((entry) => (
        <button
          key={entry.mode}
          type="button"
          className="home-modes__item"
          onClick={() => goToMode(entry.mode)}
        >
          <span className="home-modes__icon"><entry.icon /></span>
          <span className="home-modes__label">{entry.label}</span>
          <span className="home-modes__hint">{entry.hint}</span>
          <ArrowIcon />
        </button>
      ))}
    </nav>
  );
}
