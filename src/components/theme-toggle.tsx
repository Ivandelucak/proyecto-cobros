"use client";

const STORAGE_KEY = "pos-universal-theme";

export function ThemeToggle() {
  function toggleTheme() {
    const shouldUseDark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", shouldUseDark);
    localStorage.setItem(STORAGE_KEY, shouldUseDark ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Alternar modo claro y oscuro"
      className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition duration-150 hover:bg-gray-50 active:scale-[0.99] dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-100 dark:hover:bg-neutral-800"
    >
      Tema
    </button>
  );
}
