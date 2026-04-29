import { createHash } from "crypto";
import { config } from "../../config.js";

let cached: string | null = null;

/**
 * Stable per-machine browser-id for CLI flows that share storage with the UI
 * but do not have a real browser. Derived from the config dir so two CLIs on
 * the same install share favorites/annotations, but different installs (e.g.
 * different IMA2_CONFIG_DIR) stay isolated.
 */
export function getCliBrowserId(): string {
  if (cached) return cached;
  cached = "cli-" + createHash("sha1").update(config.storage.configDir).digest("hex").slice(0, 16);
  return cached;
}
