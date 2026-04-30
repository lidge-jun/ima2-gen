export const PERSISTED_KEYS = [
  // layout
  "ima2.rightPanelOpen",
  "ima2.uiMode",
  "ima2.historyStripLayout",
  // theme
  "ima2:theme",
  "ima2:themeFamily",
  // canvas
  "ima2.canvas.exportBackground.v1",
  // generation singletons
  "ima2.imageModel",
  "ima2.reasoningEffort",
  "ima2.webSearchEnabled",
  // generation defaults blob (provider/quality/size/format/moderation/count/...)
  "ima2.generationDefaults",
  // runtime
  "ima2.inFlight",
  "ima2.selectedFilename",
  "ima2.activeSessionId",
  "ima2.graphTabId",
  // gallery (added in #42)
  "ima2.galleryScope",
  "ima2.galleryDefaultScope",
  // i18n
  "ima2.locale",
] as const;

export type PersistedKey = (typeof PERSISTED_KEYS)[number];

export const RIGHT_PANEL_OPEN_STORAGE_KEY = PERSISTED_KEYS[0];
export const UI_MODE_STORAGE_KEY = PERSISTED_KEYS[1];
export const HISTORY_STRIP_LAYOUT_STORAGE_KEY = PERSISTED_KEYS[2];
export const THEME_STORAGE_KEY = PERSISTED_KEYS[3];
export const THEME_FAMILY_STORAGE_KEY = PERSISTED_KEYS[4];
export const CANVAS_EXPORT_BG_KEY = PERSISTED_KEYS[5];
export const IMAGE_MODEL_STORAGE_KEY = PERSISTED_KEYS[6];
export const REASONING_EFFORT_STORAGE_KEY = PERSISTED_KEYS[7];
export const WEB_SEARCH_STORAGE_KEY = PERSISTED_KEYS[8];
export const GENERATION_DEFAULTS_STORAGE_KEY = PERSISTED_KEYS[9];
export const IN_FLIGHT_STORAGE_KEY = PERSISTED_KEYS[10];
export const SELECTED_FILENAME_STORAGE_KEY = PERSISTED_KEYS[11];
export const ACTIVE_SESSION_ID_STORAGE_KEY = PERSISTED_KEYS[12];
export const GRAPH_TAB_ID_KEY = PERSISTED_KEYS[13];
export const GALLERY_SCOPE_STORAGE_KEY = PERSISTED_KEYS[14];
export const GALLERY_DEFAULT_SCOPE_STORAGE_KEY = PERSISTED_KEYS[15];
export const LOCALE_STORAGE_KEY = PERSISTED_KEYS[16];

export const PERSISTED_REGISTRY: Record<
  PersistedKey,
  {
    domain: "layout" | "theme" | "canvas" | "generation" | "runtime" | "gallery" | "i18n";
    shape: string;
    resetSafe: boolean;
  }
> = {
  "ima2.rightPanelOpen": { domain: "layout", shape: "json:boolean", resetSafe: true },
  "ima2.uiMode": { domain: "layout", shape: "string", resetSafe: true },
  "ima2.historyStripLayout": { domain: "layout", shape: "string", resetSafe: true },
  "ima2:theme": { domain: "theme", shape: "string", resetSafe: true },
  "ima2:themeFamily": { domain: "theme", shape: "string", resetSafe: true },
  "ima2.canvas.exportBackground.v1": { domain: "canvas", shape: "json:{mode,matteColor}", resetSafe: true },
  "ima2.imageModel": { domain: "generation", shape: "string", resetSafe: true },
  "ima2.reasoningEffort": { domain: "generation", shape: "string", resetSafe: true },
  "ima2.webSearchEnabled": { domain: "generation", shape: "string:boolean", resetSafe: true },
  "ima2.generationDefaults": { domain: "generation", shape: "json:GenerationDefaults", resetSafe: true },
  "ima2.inFlight": { domain: "runtime", shape: "json:array", resetSafe: true },
  "ima2.selectedFilename": { domain: "runtime", shape: "string", resetSafe: true },
  "ima2.activeSessionId": { domain: "runtime", shape: "string", resetSafe: true },
  "ima2.graphTabId": { domain: "runtime", shape: "session:string", resetSafe: true },
  "ima2.galleryScope": { domain: "gallery", shape: "string", resetSafe: true },
  "ima2.galleryDefaultScope": { domain: "gallery", shape: "string", resetSafe: true },
  "ima2.locale": { domain: "i18n", shape: "string", resetSafe: true },
};
