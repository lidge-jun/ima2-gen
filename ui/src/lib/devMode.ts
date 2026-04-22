// Centralized dev-mode gate. True when UI was built with VITE_IMA2_DEV=1
// or when running Vite dev server (import.meta.env.DEV).
export const IS_DEV_UI =
  import.meta.env.DEV || import.meta.env.VITE_IMA2_DEV === "1";
