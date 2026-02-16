import { cookies } from "next/headers";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE_NAME, type SupportedLocale } from "./config";

export async function getServerLocale(): Promise<SupportedLocale> {
  const jar = await cookies();
  const raw = jar.get(LOCALE_COOKIE_NAME)?.value;
  if (raw && SUPPORTED_LOCALES.includes(raw as SupportedLocale)) return raw as SupportedLocale;
  return DEFAULT_LOCALE;
}

export async function getMessages(locale: SupportedLocale) {
  return (await import(`@/messages/${locale}.json`)).default;
}
