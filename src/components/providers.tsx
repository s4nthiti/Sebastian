"use client";

import { TooltipProvider } from "@radix-ui/react-tooltip";
import { Toaster } from "sonner";
import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";
import type { Locale } from "@/lib/i18n";

type Theme = "light" | "dark" | "system";
type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: string) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const LocaleContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void } | null>(null);
const THEME_STORAGE_KEY = "sebastian-theme";
const LOCALE_STORAGE_KEY = "sebastian-locale";
const THEME_CHANGE_EVENT = "sebastian-theme-change";
const LOCALE_CHANGE_EVENT = "sebastian-locale-change";

function getStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "dark" || stored === "light" ? stored : "system";
}

function getStoredLocale(): Locale {
  return localStorage.getItem(LOCALE_STORAGE_KEY) === "th" ? "th" : "en";
}

function getThemeSnapshot() {
  const theme = getStoredTheme();
  const resolved = theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;
  return `${theme}:${resolved}`;
}

function subscribeTheme(callback: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener("storage", callback);
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  media.addEventListener("change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
    media.removeEventListener("change", callback);
  };
}

function subscribeLocale(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(LOCALE_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(LOCALE_CHANGE_EVENT, callback);
  };
}

function SebastianThemeProvider({ children }: { children: React.ReactNode }) {
  const snapshot = useSyncExternalStore(subscribeTheme, getThemeSnapshot, () => "system:light");
  const [themeValue, resolvedValue] = snapshot.split(":") as [Theme, "light" | "dark"];

  const setTheme = useCallback((value: string) => {
    const nextTheme: Theme = value === "dark" || value === "light" ? value : "system";
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedValue === "dark");
  }, [resolvedValue]);

  return <ThemeContext.Provider value={{ theme: themeValue, resolvedTheme: resolvedValue, setTheme }}>{children}</ThemeContext.Provider>;
}

function SebastianLocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribeLocale, getStoredLocale, (): Locale => "en");
  const setLocale = useCallback((nextLocale: Locale) => {
    localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT));
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside Providers");
  return value;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used inside Providers");
  return value;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SebastianThemeProvider>
      <SebastianLocaleProvider>
        <TooltipProvider delayDuration={250}>
          {children}
          <Toaster position="bottom-right" richColors />
        </TooltipProvider>
      </SebastianLocaleProvider>
    </SebastianThemeProvider>
  );
}
