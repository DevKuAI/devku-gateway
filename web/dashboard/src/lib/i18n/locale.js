// Locale helpers around Paraglide's generated runtime. Message lookup stays in
// generated functions; this module owns browser document state and Intl usage.

import {
  baseLocale,
  defineCustomClientStrategy,
  getLocale,
  getTextDirection,
  locales,
} from "../paraglide/runtime.js";
import { readStored, writeStored } from "../utils/storage.js";

const LOCALE_STORAGE_KEY = "gomodel_locale";
const LOCALE_DISPLAY_NAMES = Object.freeze({
  "zh-CN": "简体中文",
  en: "English",
});

export function supportedLocale(locale) {
  return locales.includes(locale) ? locale : undefined;
}

defineCustomClientStrategy("custom-dashboard", {
  getLocale: () => supportedLocale(readStored(LOCALE_STORAGE_KEY)),
  setLocale: (locale) =>
    writeStored(LOCALE_STORAGE_KEY, supportedLocale(locale) || baseLocale),
});

export function syncDocumentLocale() {
  const locale = getLocale();
  document.documentElement.lang = locale;
  document.documentElement.dir = getTextDirection(locale);
}

export function localeDisplayName(locale) {
  if (LOCALE_DISPLAY_NAMES[locale]) return LOCALE_DISPLAY_NAMES[locale];
  if (typeof Intl.DisplayNames !== "function") return locale;
  return new Intl.DisplayNames([locale], { type: "language" }).of(locale) || locale;
}

export function formatNumber(value, options) {
  return new Intl.NumberFormat(getLocale(), options).format(value);
}

export function formatDate(value, options) {
  return new Intl.DateTimeFormat(getLocale(), options).format(value);
}
