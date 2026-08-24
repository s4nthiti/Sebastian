"use client";

import { TooltipProvider } from "@radix-ui/react-tooltip";
import { Toaster } from "sonner";
import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";
type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: string) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getStoredTheme(): Theme {
  const stored = localStorage.getItem("sebastian-theme");
  return stored === "dark" || stored === "light" ? stored : "system";
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
  window.addEventListener("sebastian-theme-change", callback);
  media.addEventListener("change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("sebastian-theme-change", callback);
    media.removeEventListener("change", callback);
  };
}

function SebastianThemeProvider({ children }: { children: React.ReactNode }) {
  const snapshot = useSyncExternalStore(subscribeTheme, getThemeSnapshot, () => "system:light");
  const [themeValue, resolvedValue] = snapshot.split(":") as [Theme, "light" | "dark"];

  const setTheme = useCallback((value: string) => {
    const nextTheme: Theme = value === "dark" || value === "light" ? value : "system";
    localStorage.setItem("sebastian-theme", nextTheme);
    window.dispatchEvent(new Event("sebastian-theme-change"));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedValue === "dark");
  }, [resolvedValue]);

  return <ThemeContext.Provider value={{ theme: themeValue, resolvedTheme: resolvedValue, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside Providers");
  return value;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SebastianThemeProvider>
      <TooltipProvider delayDuration={250}>
        {children}
        <Toaster position="bottom-right" richColors />
      </TooltipProvider>
    </SebastianThemeProvider>
  );
}
