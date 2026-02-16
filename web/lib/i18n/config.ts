export const SUPPORTED_LOCALES = ["en", "es", "ko"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = "en";

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: "English",
  es: "Espa\u00f1ol",
  ko: "\ud55c\uad6d\uc5b4",
};

export const LOCALE_FLAGS: Record<SupportedLocale, string> = {
  en: "\ud83c\uddfa\ud83c\uddf8",
  es: "\ud83c\uddea\ud83c\uddf8",
  ko: "\ud83c\uddf0\ud83c\uddf7",
};

const LOCALE_STORAGE_KEY = "lostcity_locale";
export const LOCALE_COOKIE_NAME = "lostcity_locale";

export function getStoredLocale(): SupportedLocale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && SUPPORTED_LOCALES.includes(stored as SupportedLocale)) {
      return stored as SupportedLocale;
    }
  } catch {
    // noop
  }
  return DEFAULT_LOCALE;
}

export function setStoredLocale(locale: SupportedLocale): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    // Also set cookie for server-side access
    document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    // noop
  }
}
