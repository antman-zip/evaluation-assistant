"use client";

import { useEffect, useRef, useState } from "react";
import { useLocalStorageState } from "@/hooks/use-local-storage";

const SETTINGS_STORAGE_KEY = "evaluation.settings";

type EvaluationSettings = {
  geminiApiKey: string;
  geminiModel: string;
};

const DEFAULT_SETTINGS: EvaluationSettings = {
  geminiApiKey: "",
  geminiModel: "",
};

const GEMINI_MODELS = [
  { value: "", label: "서버 기본값 사용" },
  { value: "gemini-3-pro-preview", label: "Gemini 3 Pro Preview" },
  { value: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
];

export function useEvaluationSettings() {
  const { state } = useLocalStorageState<EvaluationSettings>(
    SETTINGS_STORAGE_KEY,
    DEFAULT_SETTINGS
  );
  return state;
}

export function SettingsModal() {
  const { state, setState } = useLocalStorageState<EvaluationSettings>(
    SETTINGS_STORAGE_KEY,
    DEFAULT_SETTINGS
  );
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<EvaluationSettings>(state);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setDraft(state);
    }
  }, [open, state]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const handleSave = () => {
    setState(draft);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-5 top-5 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white/90 text-slate-700 shadow-md backdrop-blur transition hover:scale-[1.03] hover:bg-white dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-100 dark:hover:bg-slate-800"
        aria-label="설정"
        title="설정"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58ZM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2Z" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            className="mx-4 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                API 설정
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                aria-label="닫기"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                  <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12Z" />
                </svg>
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <div>
                <label
                  htmlFor="settings-gemini-api-key"
                  className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300"
                >
                  Gemini API Key
                </label>
                <input
                  id="settings-gemini-api-key"
                  type="password"
                  value={draft.geminiApiKey}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, geminiApiKey: e.target.value }))
                  }
                  placeholder="비워두면 서버 환경변수 사용"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-brand-teal transition focus:ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
                />
              </div>

              <div>
                <label
                  htmlFor="settings-gemini-model"
                  className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300"
                >
                  Gemini Model
                </label>
                <select
                  id="settings-gemini-model"
                  value={draft.geminiModel}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, geminiModel: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-brand-teal transition focus:ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {GEMINI_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-xl bg-brand-teal px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
              >
                저장
              </button>
            </div>

            <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
              설정값은 이 브라우저의 localStorage에만 저장됩니다.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
