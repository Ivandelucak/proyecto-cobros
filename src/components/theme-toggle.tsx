"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "pos-universal-theme";
const THEME_CHANGE_EVENT = "pos-universal-theme-change";
const THEME_TRANSITION_CLASS = "theme-transitioning";
const THEME_TRANSITION_CLEANUP_MS = 460;
type ThemeValue = "light" | "dark";
type ViewTransitionHandle = {
  finished?: Promise<unknown>;
};
type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => ViewTransitionHandle;
};
let themeTransitionCleanupTimer: number | undefined;

export function ThemeToggle() {
  const isDark = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot
  );

  function toggleTheme() {
    const nextTheme: ThemeValue = document.documentElement.classList.contains("dark")
      ? "light"
      : "dark";
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const transitionDocument = document as ViewTransitionDocument;
    const apply = () => applyTheme(nextTheme);

    document.documentElement.classList.remove("no-theme-transition");
    if (reducedMotion) {
      apply();
      return;
    }

    beginThemeTransition();

    if (typeof transitionDocument.startViewTransition === "function") {
      const transition = transitionDocument.startViewTransition(apply);
      if (transition.finished) {
        void transition.finished.finally(endThemeTransition);
      } else {
        endThemeTransition();
      }
      return;
    }

    apply();
    endThemeTransition();
  }

  const label = isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className="btn-secondary group inline-flex h-10 w-10 items-center justify-center rounded-md shadow-sm transition-[background-color,border-color,color,box-shadow,transform] duration-200 hover:shadow-md hover:shadow-slate-300/20 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 dark:hover:shadow-none dark:focus-visible:ring-offset-[#0B1015]"
    >
      <span className="sr-only">{label}</span>
      <span className="block dark:hidden">
        <MoonIcon />
      </span>
      <span className="hidden dark:block">
        <SunIcon />
      </span>
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
  return getDocumentTheme() === "dark";
}

function getServerThemeSnapshot() {
  return false;
}

function applyTheme(theme: ThemeValue) {
  const root = document.documentElement;
  const isDark = theme === "dark";
  root.classList.toggle("dark", isDark);
  root.classList.toggle("light", !isDark);
  root.style.colorScheme = theme;
  root.dataset.theme = theme;
  root.dataset.themeReady = "true";

  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage can be blocked in hardened browser contexts.
  }

  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

function beginThemeTransition() {
  window.clearTimeout(themeTransitionCleanupTimer);
  document.documentElement.classList.add(THEME_TRANSITION_CLASS);
}

function endThemeTransition() {
  window.clearTimeout(themeTransitionCleanupTimer);
  themeTransitionCleanupTimer = window.setTimeout(() => {
    document.documentElement.classList.remove(THEME_TRANSITION_CLASS);
  }, THEME_TRANSITION_CLEANUP_MS);
}

function getDocumentTheme(): ThemeValue {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
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
