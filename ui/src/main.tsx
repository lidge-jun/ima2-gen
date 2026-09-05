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
import App from "./App";

function canonicalizeLocalhostOrigin(): boolean {
  if (window.location.protocol !== "http:" || window.location.hostname !== "localhost") {
    return false;
  }
  const next = new URL(window.location.href);
  next.hostname = "127.0.0.1";
  window.location.replace(next.toString());
  return true;
}

if (!canonicalizeLocalhostOrigin()) {
  initTheme();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
