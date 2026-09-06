export type Locale = "ko" | "en" | "zh-Hant" | "zh-Hans";

export const SUPPORTED_LOCALES: readonly Locale[] = ["ko", "en", "zh-Hant", "zh-Hans"];

export function loadLocale(): Locale {
  try {
    const raw = localStorage.getItem("ima2.locale");
    if (raw === "ko" || raw === "en" || raw === "zh-Hant" || raw === "zh-Hans") return raw;
  } catch { /* storage disabled */ }
  if (typeof navigator !== "undefined") {
    const nav = navigator.language || "";
    if (nav.toLowerCase().startsWith("ko")) return "ko";
    const normalized = nav.toLowerCase();
    if (/^(zh[-_](tw|hk|mo|hant)|zh-hant)/.test(normalized)) return "zh-Hant";
    if (/^(zh[-_](cn|sg|hans)|zh)/.test(normalized)) return "zh-Hans";
  }
  return "en";
}

export function saveLocale(locale: Locale): void {
  try { localStorage.setItem("ima2.locale", locale); }
  catch { /* storage disabled */ }
}
