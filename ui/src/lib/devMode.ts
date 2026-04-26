// Centralized runtime gates. IS_DEV_UI still flags dev/HMR builds for tools
// that should never ship in production (debug panels, raw console pipes).
// ENABLE_NODE_MODE controls whether the user-facing node-mode tab is shown
// in packaged builds — default-on as of Phase 4.2 sub-PR 8 (productize).
// Set VITE_IMA2_NODE_MODE=0 at build time to ship a release that hides it.
export const IS_DEV_UI =
  import.meta.env.DEV || import.meta.env.VITE_IMA2_DEV === "1";

export const ENABLE_NODE_MODE = import.meta.env.VITE_IMA2_NODE_MODE !== "0";
