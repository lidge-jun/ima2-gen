// Centralized runtime gates. Node mode is now a product feature in packaged
// builds; set VITE_IMA2_NODE_MODE=0 only when a release must hide it.
export const IS_DEV_UI =
  import.meta.env.DEV || import.meta.env.VITE_IMA2_DEV === "1";

export const ENABLE_NODE_MODE = import.meta.env.VITE_IMA2_NODE_MODE !== "0";
