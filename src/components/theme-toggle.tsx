"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "pos-universal-theme";
const THEME_CHANGE_EVENT = "pos-universal-theme-change";

export function ThemeToggle() {
  const isDark = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot
  );

  function toggleTheme() {
    const shouldUseDark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", shouldUseDark);
    document.documentElement.style.colorScheme = shouldUseDark ? "dark" : "light";
    document.documentElement.dataset.theme = shouldUseDark ? "dark" : "light";
    document.documentElement.dataset.themeReady = "true";
    localStorage.setItem(STORAGE_KEY, shouldUseDark ? "dark" : "light");
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  const label = isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className="group inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm transition-[background-color,border-color,color,box-shadow,transform] duration-200 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 hover:shadow-md hover:shadow-slate-300/20 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-100 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/10 dark:hover:text-brand-100 dark:hover:shadow-none dark:focus-visible:ring-offset-neutral-950"
    >
      <span className="sr-only">{label}</span>
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function subscribeToTheme(callback: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getThemeSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerThemeSnapshot() {
  return false;
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 transition-transform duration-200 group-hover:-rotate-6">
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        d="M20 15.5A8.3 8.3 0 0 1 8.5 4 7.8 7.8 0 1 0 20 15.5Z"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 transition-transform duration-200 group-hover:rotate-45">
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        d="M12 4V2.5m0 19V20m7.5-8H21M3 12h1.5m12.8-5.3 1.1-1.1M5.6 18.4l1.1-1.1m0-10.6L5.6 5.6m12.8 12.8-1.1-1.1M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"
      />
    </svg>
  );
}
