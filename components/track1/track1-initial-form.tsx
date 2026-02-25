"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocalStorageState } from "@/hooks/use-local-storage";
import { useEvaluationSettings } from "@/components/settings/settings-modal";
import {
  PERFORMANCE_GRADE_SCORES,
  TRACK1_INITIAL_VALUE,
  type PerformanceGrade,
  type Track1Form
} from "@/types/evaluation";

const TRACK1_STORAGE_KEY = "evaluation.track1.step1.v3";
const GRADES: PerformanceGrade[] = ["탁월", "우수", "달성", "노력", "미흡"];

type Track1Item = Track1Form & { id: string };
type Track1WizardState = {
  items: Track1Item[];
  selectedItemId: string;
};

type FieldRowProps = {
  label: string;
  children: React.ReactNode;
  noBorder?: boolean;
};

type SidebarItem = Track1Item & {
  index: number;
  title: string;
  subtitle: string;
  weight: number;
};

type AchievementListPanelProps = {
  items: SidebarItem[];
  selectedItemId: string;
  onAddItem: () => void;
  onSelectItem: (id: string) => void;
};

function createItemId() {
  return `item-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function createTrack1Item(): Track1Item {
  return {
    id: createItemId(),
    ...TRACK1_INITIAL_VALUE
  };
}

function createInitialState(): Track1WizardState {
  const firstItem = createTrack1Item();
  return {
    items: [firstItem],
    selectedItemId: firstItem.id
  };
}

const INITIAL_STATE = createInitialState();

function FieldRow({ label, children, noBorder = false }: FieldRowProps) {
  return (
    <div
      className={`grid md:grid-cols-[180px_1fr] ${noBorder ? "" : "border-b border-slate-200 dark:border-slate-700"}`}
    >
      <div className="bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
        {label}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function AchievementListPanel({
  items,
  selectedItemId,
  onAddItem,
  onSelectItem
}: AchievementListPanelProps) {
  return (
    <aside className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/70">
      <button
        type="button"
        onClick={onAddItem}
        className="mb-3 inline-flex w-full items-center justify-center rounded-xl border border-teal-300 bg-white px-3 py-2 text-sm font-semibold text-teal-700 transition hover:bg-teal-50 dark:border-teal-700 dark:bg-slate-800 dark:text-teal-300 dark:hover:bg-slate-700"
      >
        + 업적 추가
      </button>

      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectItem(item.id)}
            className={`w-full rounded-xl border p-3 text-left transition ${
              item.id === selectedItemId
                ? "border-blue-400 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/40"
                : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
            }`}
          >
            <p className="line-clamp-1 text-sm font-bold text-slate-900 dark:text-slate-100">{item.title}</p>
            <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</p>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-1.5 rounded-full bg-blue-500"
                  style={{ width: `${Math.max(0, Math.min(100, item.weight))}%` }}
                />
              </div>
              <span className="w-10 text-right text-xs font-semibold text-slate-700 dark:text-slate-200">
                {item.weight}%
              </span>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}

function parsePercent(value: string): number | "" {
  if (value === "") return "";
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return "";
  return Math.max(0, Math.min(100, parsed));
}

export function Track1InitialForm() {
  const { state, setState, isHydrated } = useLocalStorageState<Track1WizardState>(
    TRACK1_STORAGE_KEY,
    INITIAL_STATE
  );
  const [lastSavedAt, setLastSavedAt] = useState<string>("");
  const [isRefining, setIsRefining] = useState(false);
  const [refineError, setRefineError] = useState<string>("");
  const [lastRefinedAt, setLastRefinedAt] = useState<string>("");
  const evaluationSettings = useEvaluationSettings();

  const selectedItemIndex = state.items.findIndex((item) => item.id === state.selectedItemId);
  const selectedItem = selectedItemIndex >= 0 ? state.items[selectedItemIndex] : state.items[0];

  useEffect(() => {
    if (!isHydrated) return;
    setLastSavedAt(new Date().toLocaleTimeString("ko-KR", { hour12: false }));
  }, [state, isHydrated]);

  useEffect(() => {
    if (!state.items.length) {
      const replacement = createTrack1Item();
      setState({ items: [replacement], selectedItemId: replacement.id });
      return;
    }
    if (selectedItemIndex === -1) {
      setState((prev) => ({ ...prev, selectedItemId: prev.items[0].id }));
    }
  }, [selectedItemIndex, setState, state.items]);

  const updateSelectedItem = (updater: (item: Track1Item) => Track1Item) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === prev.selectedItemId ? updater(item) : item))
    }));
  };

  const updateItemById = (id: string, updater: (item: Track1Item) => Track1Item) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? updater(item) : item))
    }));
  };

  const setField = <K extends keyof Track1Form>(key: K, value: Track1Form[K]) => {
    updateSelectedItem((item) => ({ ...item, [key]: value }));
  };

  const addItem = () => {
    const newItem = createTrack1Item();
    setState((prev) => ({
      items: [...prev.items, newItem],
      selectedItemId: newItem.id
    }));
  };

  const deleteSelectedItem = () => {
    setState((prev) => {
      if (prev.items.length <= 1) {
        const replacement = createTrack1Item();
        return {
          items: [replacement],
          selectedItemId: replacement.id
        };
      }

      const currentIndex = prev.items.findIndex((item) => item.id === prev.selectedItemId);
      const nextItems = prev.items.filter((item) => item.id !== prev.selectedItemId);
      const nextIndex = currentIndex <= 0 ? 0 : currentIndex - 1;

      return {
        items: nextItems,
        selectedItemId: nextItems[Math.min(nextIndex, nextItems.length - 1)].id
      };
    });
  };

  const resetSelectedItem = () => {
    updateSelectedItem((item) => ({
      id: item.id,
      ...TRACK1_INITIAL_VALUE
    }));
  };

  const refineSelectedItem = async () => {
    if (isRefining || !selectedItem) return;

    setRefineError("");
    setIsRefining(true);

    const targetItemId = selectedItem.id;

    try {
      const response = await fetch("/api/assistant/refine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          item: {
            goalCategory: selectedItem.goalCategory,
            roleAndResponsibilities: selectedItem.roleAndResponsibilities,
            goalTaskWeight: selectedItem.goalTaskWeight,
            kpiName: selectedItem.kpiName,
            kpiTask: selectedItem.kpiTask,
            achievementPlan: selectedItem.achievementPlan,
            kpiFormula: selectedItem.kpiFormula,
            subTaskWeight: selectedItem.subTaskWeight,
            grade: selectedItem.grade,
            score: selectedItem.score,
            achievementResult: selectedItem.achievementResult
          },
          geminiApiKey: evaluationSettings.geminiApiKey || undefined,
          geminiModel: evaluationSettings.geminiModel || undefined
        })
      });

      const data = (await response.json()) as { refinedText?: string; error?: string };

      if (!response.ok) {
        throw new Error(data.error || "AI 문장 다듬기 요청에 실패했습니다.");
      }

      const refinedText = (data.refinedText || "").trim();
      if (!refinedText) {
        throw new Error("AI가 비어있는 결과를 반환했습니다.");
      }

      updateItemById(targetItemId, (item) => ({
        ...item,
        achievementResult: refinedText.slice(0, 2000)
      }));
      setLastRefinedAt(new Date().toLocaleTimeString("ko-KR", { hour12: false }));
    } catch (error) {
      setRefineError(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsRefining(false);
    }
  };

  const sortedItems = useMemo(
    () =>
      state.items.map((item, index) => {
        const weight = item.goalTaskWeight === "" ? 0 : item.goalTaskWeight;
        const title = item.goalCategory.trim() || `업적 ${index + 1}`;
        const subtitle = item.kpiName.trim() || "KPI명을 입력하세요.";
        return { ...item, index, title, subtitle, weight };
      }),
    [state.items]
  );

  if (!selectedItem) return null;

  return (
    <section className="rounded-3xl border border-teal-100 bg-white p-6 shadow-card md:p-8 dark:border-teal-900 dark:bg-slate-900/85">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5 dark:border-slate-700">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal">Track 1 | Step 1/4</p>
          <h2 className="mt-1 text-xl font-bold text-brand-ink dark:text-slate-100">피평가자 업적평가 입력</h2>
        </div>
        <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {isHydrated ? `자동 저장됨: ${lastSavedAt || "방금"}` : "저장소 동기화 중"}
        </span>
      </div>

      <div className="mt-6 xl:relative xl:pl-2">
        <div className="mb-4 xl:hidden">
          <AchievementListPanel
            items={sortedItems}
            selectedItemId={state.selectedItemId}
            onAddItem={addItem}
            onSelectItem={(id) => setState((prev) => ({ ...prev, selectedItemId: id }))}
          />
        </div>

        <div className="hidden xl:absolute xl:-left-[340px] xl:top-0 xl:block xl:w-[290px]">
          <AchievementListPanel
            items={sortedItems}
            selectedItemId={state.selectedItemId}
            onAddItem={addItem}
            onSelectItem={(id) => setState((prev) => ({ ...prev, selectedItemId: id }))}
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
          <FieldRow label="목표구분">
            <input
              value={selectedItem.goalCategory}
              onChange={(event) => setField("goalCategory", event.target.value)}
              placeholder="목표구분을 입력하세요."
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-brand-teal transition focus:ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
            />
          </FieldRow>

          <FieldRow label="R&R">
            <input
              value={selectedItem.roleAndResponsibilities}
              onChange={(event) => setField("roleAndResponsibilities", event.target.value)}
              placeholder="R&R을 입력하세요."
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-brand-teal transition focus:ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
            />
          </FieldRow>

          <FieldRow label="목표과업 비중">
            <div className="flex max-w-xs items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                step={5}
                value={selectedItem.goalTaskWeight}
                onChange={(event) => setField("goalTaskWeight", parsePercent(event.target.value))}
                placeholder="0-100"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-brand-teal transition focus:ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
              />
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">%</span>
            </div>
          </FieldRow>

          <FieldRow label="KPI명">
            <input
              value={selectedItem.kpiName}
              onChange={(event) => setField("kpiName", event.target.value)}
              placeholder="KPI명을 입력하세요."
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-brand-teal transition focus:ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
            />
          </FieldRow>

          <FieldRow label="KPI과제">
            <textarea
              rows={2}
              value={selectedItem.kpiTask}
              onChange={(event) => setField("kpiTask", event.target.value)}
              placeholder="KPI과제를 입력하세요."
              className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm leading-6 outline-none ring-brand-teal transition focus:ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
            />
          </FieldRow>

          <FieldRow label="달성계획">
            <textarea
              rows={3}
              value={selectedItem.achievementPlan}
              onChange={(event) => setField("achievementPlan", event.target.value)}
              placeholder="달성계획을 입력하세요."
              className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm leading-6 outline-none ring-brand-teal transition focus:ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
            />
          </FieldRow>

          <FieldRow label="KPI산식">
            <textarea
              rows={3}
              value={selectedItem.kpiFormula}
              onChange={(event) => setField("kpiFormula", event.target.value)}
              placeholder="KPI산식을 입력하세요."
              className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm leading-6 outline-none ring-brand-teal transition focus:ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
            />
          </FieldRow>

          <FieldRow label="하위과업 비중">
            <div className="flex max-w-xs items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                step={5}
                value={selectedItem.subTaskWeight}
                onChange={(event) => setField("subTaskWeight", parsePercent(event.target.value))}
                placeholder="0-100"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-brand-teal transition focus:ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
              />
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">%</span>
            </div>
          </FieldRow>

          <FieldRow label="등급">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedItem.grade}
                onChange={(event) => {
                  const nextGrade = event.target.value as PerformanceGrade;
                  updateSelectedItem((item) => ({
                    ...item,
                    grade: nextGrade,
                    score: PERFORMANCE_GRADE_SCORES[nextGrade]
                  }));
                }}
                className="w-full max-w-xs rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-brand-teal transition focus:ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {GRADES.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
              <span className="rounded-lg bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                자동 점수: {selectedItem.score}점
              </span>
            </div>
          </FieldRow>

          <FieldRow label="달성실적" noBorder>
            <textarea
              rows={8}
              maxLength={2000}
              value={selectedItem.achievementResult}
              onChange={(event) => setField("achievementResult", event.target.value)}
              placeholder="달성실적을 입력하세요."
              className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm leading-6 outline-none ring-brand-teal transition focus:ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
            />
            <p className="mt-2 text-right text-xs text-slate-500 dark:text-slate-400">
              {selectedItem.achievementResult.length} / 2000자
            </p>
          </FieldRow>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={resetSelectedItem}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            현재 항목 초기화
          </button>
          <button
            type="button"
            onClick={refineSelectedItem}
            disabled={isRefining}
            className="rounded-xl bg-brand-teal px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRefining ? "AI 다듬는 중..." : "AI 문장 다듬기 (다음 단계)"}
          </button>
        </div>
        <button
          type="button"
          onClick={deleteSelectedItem}
          className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/60"
        >
          이 항목 삭제
        </button>
      </div>
      {(refineError || lastRefinedAt) && (
        <div className="mt-3 text-xs">
          {refineError ? (
            <p className="font-medium text-rose-600 dark:text-rose-300">{refineError}</p>
          ) : (
            <p className="font-medium text-teal-700 dark:text-teal-300">
              AI 문장 다듬기 완료: {lastRefinedAt}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
