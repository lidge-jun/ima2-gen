import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { initTheme } from "./hooks/useTheme";
import "./styles/canvas-mode.css";
import "./styles/canvas-annotations.css";
import "./styles/canvas-background-cleanup.css";
import "./styles/classic-workspace.css";
import "./styles/composer-flow.css";
import "./styles/gallery-controls.css";
import "./styles/prompt-builder.css";
import "./styles/prompt-builder-messages.css";
import "./styles/sidebar-history.css";
import "./styles/settings-controls.css";
import "./styles/viewer-workflow.css";
import "./styles/result-preview.css";
import "./styles/agent-workspace.css";
import "./styles/agent-workspace-panels.css";
import "./styles/agent-panels-composer.css";
import "./styles/agent-workspace-image.css";
import "./styles/agent-workspace-sidebar.css";
import "./styles/agent-stage.css";
import "./styles/assets-workspace.css";
import "./styles/assetgen-workspace.css";
import "./styles/home-workspace.css";
import "./styles/composer-panes.css";
import "./styles/quota-card.css";
import "./styles/favorite-star.css";
import { LanConnecting, LanSignIn } from "./components/LanSignIn";
import { bootstrapLanSession, createLanAuthError, getLanSessionState,
  LAN_AUTH_REQUIRED_EVENT, refreshLanSession } from "./lib/lanSession";

function canonicalizeLocalhostOrigin(): boolean {
  if (window.location.protocol !== "http:" || window.location.hostname !== "localhost") {
    return false;
  }
  const next = new URL(window.location.href);
  next.hostname = "127.0.0.1";
  window.location.replace(next.toString());
  return true;
}

const root = createRoot(document.getElementById("root")!);
let renderRevision = 0;
let themeInitialized = false;

function showSignIn(error?: unknown) {
  const revision = ++renderRevision;
  root.render(<StrictMode><LanSignIn key={revision} error={error}
    onConnected={showAuthenticatedApp} onRetry={boot} /></StrictMode>);
}

async function showAuthenticatedApp(): Promise<void> {
  const revision = ++renderRevision;
  const status = getLanSessionState();
  if (!status?.authenticated) { showSignIn(); return; }
  if (status.mode === "local" && canonicalizeLocalhostOrigin()) return;
  try {
    if (!themeInitialized) { initTheme(); themeInitialized = true; }
    const { default: App } = await import("./App");
    if (revision !== renderRevision || !getLanSessionState()?.authenticated) return;
    root.render(<StrictMode><App /></StrictMode>);
  } catch (error) { if (revision === renderRevision) showSignIn(error); }
}

async function boot(): Promise<void> {
  const revision = ++renderRevision;
  root.render(<StrictMode><LanConnecting /></StrictMode>);
  try {
    const status = await bootstrapLanSession();
    if (revision !== renderRevision) return;
    if (!status.authenticated) showSignIn();
    else await showAuthenticatedApp();
  } catch (error) { if (revision === renderRevision) showSignIn(error); }
}

window.addEventListener(LAN_AUTH_REQUIRED_EVENT, () => showSignIn(createLanAuthError()));
window.addEventListener("error", (event) => {
  if (getLanSessionState()?.mode !== "lan" || !getLanSessionState()?.authenticated) return;
  const element = event.target;
  if (!(element instanceof HTMLImageElement) && !(element instanceof HTMLVideoElement)) return;
  try {
    const url = new URL(element.currentSrc || element.src, window.location.href);
    if (url.origin !== window.location.origin || !/^\/generated(?:\/|$)/i.test(url.pathname)) return;
    void refreshLanSession().catch(() => { /* A media/network error alone is not proof of expired auth. */ });
  } catch { /* An invalid media URL is not an authentication observation. */ }
}, true);
void boot();
