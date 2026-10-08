"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const themeStorageKey = "focuslearn-theme";
const themeChangeEvent = "focuslearn-theme-change";

function subscribe(listener: () => void) {
  window.addEventListener(themeChangeEvent, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(themeChangeEvent, listener);
    window.removeEventListener("storage", listener);
  };
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot() {
  return false;
}

/** Global, persisted appearance control for the entire application. */
export function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleTheme = useCallback(() => {
    const nextDark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", nextDark);
    document.documentElement.style.colorScheme = nextDark ? "dark" : "light";
    localStorage.setItem(themeStorageKey, nextDark ? "dark" : "light");
    window.dispatchEvent(new Event(themeChangeEvent));
  }, []);

  const label = isDark ? "Chuyển sang nền sáng" : "Chuyển sang nền tối";

  return <button type="button" aria-label={label} title={label} aria-pressed={isDark} onClick={toggleTheme} className="fixed bottom-5 right-5 z-40 grid size-11 place-items-center rounded-full border border-[#d2ddd0] bg-[#f0f4ed] text-[#2e5339] shadow-lg transition hover:-translate-y-0.5 hover:bg-[#e6ece2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2e5339] focus-visible:ring-offset-2" suppressHydrationWarning>
    {isDark ? <Sun size={19} /> : <Moon size={19} />}
  </button>;
}
