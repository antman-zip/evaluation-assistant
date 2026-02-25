"use client";

import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "evaluation.theme";

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "dark") {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.style.colorScheme = "light";
  }
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initialMode: ThemeMode = saved === "dark" ? "dark" : "light";
    setMode(initialMode);
    applyTheme(initialMode);
  }, []);

  const onToggle = () => {
    const nextMode: ThemeMode = mode === "light" ? "dark" : "light";
    setMode(nextMode);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextMode);
    applyTheme(nextMode);
  };

  return (
    <button
      type="button"
      onClick={onToggle}
      className="fixed right-[4.5rem] top-5 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white/90 text-slate-700 shadow-md backdrop-blur transition hover:scale-[1.03] hover:bg-white dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-100 dark:hover:bg-slate-800"
      aria-label={mode === "light" ? "다크 모드로 전환" : "라이트 모드로 전환"}
      title={mode === "light" ? "다크 모드" : "라이트 모드"}
    >
      {mode === "light" ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
          <path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />
          <path d="M12 2a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1ZM12 19a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1ZM4.22 5.64a1 1 0 0 1 1.42 0l1.41 1.41a1 1 0 1 1-1.41 1.42L4.22 7.05a1 1 0 0 1 0-1.41ZM16.95 18.36a1 1 0 0 1 1.41 0l1.42 1.42a1 1 0 0 1-1.42 1.41l-1.41-1.41a1 1 0 0 1 0-1.42ZM2 12a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1ZM19 12a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2h-2a1 1 0 0 1-1-1ZM5.64 19.78a1 1 0 0 1 0-1.42l1.41-1.41a1 1 0 1 1 1.42 1.41l-1.41 1.42a1 1 0 0 1-1.42 0ZM18.36 7.05a1 1 0 0 1 0-1.41l1.42-1.42a1 1 0 1 1 1.41 1.42l-1.41 1.41a1 1 0 0 1-1.42 0Z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a1 1 0 0 1 1.03 1.43A7 7 0 0 0 19.57 11a1 1 0 0 1 1.43 1.8Z" />
        </svg>
      )}
    </button>
  );
}
