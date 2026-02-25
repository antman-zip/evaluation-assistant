"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useLocalStorageState } from "@/hooks/use-local-storage";
import { useEvaluationSettings } from "@/components/settings/settings-modal";
import { PERFORMANCE_GRADE_SCORES, type Track1Form } from "@/types/evaluation";
import type {
  WorkLogEntry,
  WorkLogFolder,
  WorkLogSeason,
  WorkLogSelection,
  WorkLogState,
  WorkLogType
} from "@/types/work-log";
import { hasSampleData, loadSampleData, removeSampleData } from "./sample-data";

const WORK_LOG_STORAGE_KEY = "evaluation.work-log.v2";
const TRACK1_STORAGE_KEY = "evaluation.track1.step1.v3";
const WORK_TYPES: WorkLogType[] = ["이벤트", "프로젝트", "태스크", "기타"];
type FolderSortOrder = "default" | "latest" | "updated" | "oldest";
type TopTab = "work-log" | "track1-preview" | "overall-review";

type Track1WizardItem = Track1Form & { id: string };
type Track1WizardState = {
  items: Track1WizardItem[];
  selectedItemId: string;
};

type Track1Candidate = Track1Form & {
  id: string;
  sourceEntryCount: number;
  sourcePeriod: string;
  sourceFolderLabel: string;
  sourceFolderId: string | null;
  sourceEntryIds: string[];
  sourceType: WorkLogType;
};

type CandidateProgress = {
  baselineConfirmed: boolean;
  formulaConfirmed: boolean;
  targetConfirmed: boolean;
  readyToApply: boolean;
};

type CandidateChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type CandidateChatState = {
  messages: CandidateChatMessage[];
  progress: CandidateProgress;
};

type SubTaskCard = {
  id: string;
  kpiName: string;
  kpiTask: string;
  achievementPlan: string;
  kpiFormula: string;
  subTaskWeight: number | "";
  locked: boolean;
};

function createSubTaskCardId() {
  return `stc-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

type CandidateCoachResponse = {
  reply: string;
  progress?: Partial<CandidateProgress>;
  suggestedUpdates?: Partial<Track1Form>;
};

function timeValue(iso: string) {
  const value = new Date(iso).getTime();
  return Number.isNaN(value) ? 0 : value;
}

function sortFolders(list: WorkLogFolder[], order: FolderSortOrder) {
  const copied = [...list];
  if (order === "latest") {
    copied.sort((a, b) => timeValue(b.createdAt) - timeValue(a.createdAt));
    return copied;
  }
  if (order === "updated") {
    copied.sort((a, b) => timeValue(b.updatedAt) - timeValue(a.updatedAt));
    return copied;
  }
  if (order === "oldest") {
    copied.sort((a, b) => timeValue(a.createdAt) - timeValue(b.createdAt));
    return copied;
  }
  // default: keep user's current order in state
  return copied;
}

function nowIso() {
  return new Date().toISOString();
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function parseYmdToUtcDate(dateIso: string) {
  const [y, m, d] = dateIso.split("-").map((v) => Number(v));
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function formatUtcYmd(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDurationValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

function calculateWorkPeriod(dateIso: string, weeks: number, days: number) {
  const end = parseYmdToUtcDate(dateIso);
  if (!end) return null;
  const totalDays = Math.max(1, normalizeDurationValue(weeks, 0) * 7 + normalizeDurationValue(days, 0));
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (totalDays - 1));
  return {
    startDate: formatUtcYmd(start),
    endDate: formatUtcYmd(end),
    totalDays
  };
}

function createFolderId() {
  return `folder-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function createEntryId() {
  return `work-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function createTrack1ItemId() {
  return `item-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function normalizeEntryText(value: string | null | undefined) {
  return (value ?? "").trim();
}

function splitTags(value: string) {
  return value
    .split(/[,\n/|]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function uniqueList(values: string[]) {
  const output: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
}

function roundToNearestStep(value: number, step: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value / step) * step;
}

function createMessageId() {
  return `msg-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function baseProgress(): CandidateProgress {
  return {
    baselineConfirmed: false,
    formulaConfirmed: false,
    targetConfirmed: false,
    readyToApply: false
  };
}

function makeMessage(role: "user" | "assistant", content: string): CandidateChatMessage {
  return {
    id: createMessageId(),
    role,
    content: content.trim(),
    createdAt: nowIso()
  };
}

function inferRoleAndResponsibilities(tags: string[], titles: string[], folderName: string) {
  const candidates = uniqueList([...tags, ...titles.map((title) => title.replace(/\s+/g, " ").trim())]);
  const top = candidates.slice(0, 3);
  if (top.length) return top.join(", ");
  return `${folderName} 관련 운영 및 실행`;
}

function inferKpiTask(titles: string[], contexts: string[]) {
  const subTasks = uniqueList(titles).slice(0, 4);
  const contextSummary = uniqueList(contexts).slice(0, 2).join(" / ");
  if (subTasks.length) {
    return `하위과업: ${subTasks.join(", ")}${contextSummary ? ` | 실행포인트: ${contextSummary}` : ""}`;
  }
  return contextSummary || "핵심 과업 실행 및 품질 유지";
}

function gradeThresholdScaleBlock() {
  return ["탁월: 120% 이상", "우수: 110% 이상", "달성: 100% 이상", "노력: 80% 이상", "미흡: 80% 미만"].join(
    "\n"
  );
}

function hasGradeThresholdScale(text: string) {
  return ["탁월", "우수", "달성", "노력", "미흡"].every((keyword) => text.includes(keyword));
}

function defaultFormulaByType(type: WorkLogType) {
  if (type === "이벤트") return "(기한 내 완료 건수 / 계획 건수) * 100";
  if (type === "프로젝트") return "(완료 마일스톤 수 / 계획 마일스톤 수) * 100";
  if (type === "태스크") return "(주간 완료 건수 / 주간 목표 건수) * 100";
  return "(완료 업무 수 / 계획 업무 수) * 100";
}

function inferKpiFormula(metrics: string[], type: WorkLogType) {
  const normalized = uniqueList(metrics);
  const metricBase = normalized[0];
  if (metricBase) {
    if (hasGradeThresholdScale(metricBase)) return metricBase;
    return `${metricBase}\n${gradeThresholdScaleBlock()}`;
  }
  return `${defaultFormulaByType(type)}\n${gradeThresholdScaleBlock()}`;
}

function inferAchievementPlan(_periodLabel: string, titles: string[], contexts: string[]) {
  const topTitles = uniqueList(titles).slice(0, 2);
  const topContexts = uniqueList(contexts).slice(0, 2);
  const firstMilestone = topTitles[0] || "핵심 과업 착수";
  const secondMilestone = topTitles[1] || "중간 산출물 제작";
  const qualityMilestone = topContexts[0] || "품질 검수 및 피드백 반영";
  const stabilizationMilestone = topContexts[1] || "성과 지표 점검 및 운영 안정화";

  return [
    `1. ${firstMilestone} 수행 및 1차 산출물 확보`,
    `2. ${secondMilestone} 실행으로 일정/품질 리스크를 선제적으로 보완`,
    `3. ${qualityMilestone}를 통해 완성도와 재작업률을 관리`,
    `4. ${stabilizationMilestone} 기반으로 KPI 결과값을 주기적으로 점검`
  ].join("\n");
}

function mergeCandidateProgress(a: CandidateProgress, b?: Partial<CandidateProgress>) {
  if (!b) return a;
  return {
    baselineConfirmed: b.baselineConfirmed ?? a.baselineConfirmed,
    formulaConfirmed: b.formulaConfirmed ?? a.formulaConfirmed,
    targetConfirmed: b.targetConfirmed ?? a.targetConfirmed,
    readyToApply: b.readyToApply ?? a.readyToApply
  };
}

function hasTargetSignal(text: string) {
  return /\d/.test(text);
}

function parsePercentInput(value: string): number | "" {
  if (value === "") return "";
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return "";
  return Math.max(0, Math.min(100, parsed));
}

function cloneEntries(entries: WorkLogEntry[]) {
  return entries.map((entry) => ({ ...entry }));
}

function entriesEqualForPreviewGuard(a: WorkLogEntry[], b: WorkLogEntry[]) {
  if (a.length !== b.length) return false;
  const byIdB = new Map(b.map((entry) => [entry.id, entry]));
  for (const left of a) {
    const right = byIdB.get(left.id);
    if (!right) return false;
    if (left.folderId !== right.folderId) return false;
    if (left.sortOrder !== right.sortOrder) return false;
    if (left.title !== right.title) return false;
    if (left.type !== right.type) return false;
    if (left.date !== right.date) return false;
    if (left.durationWeeks !== right.durationWeeks) return false;
    if (left.durationDays !== right.durationDays) return false;
    if (left.context !== right.context) return false;
    if (left.result !== right.result) return false;
    if (left.metrics !== right.metrics) return false;
    if (left.tags !== right.tags) return false;
  }
  return true;
}

function safeTrack1State(raw: unknown): Track1WizardState | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<Track1WizardState>;
  if (!Array.isArray(candidate.items)) return null;
  const items = candidate.items.filter((item) => !!item && typeof item === "object") as Track1WizardItem[];
  if (!items.length) return null;
  const selectedItemId =
    typeof candidate.selectedItemId === "string" && candidate.selectedItemId
      ? candidate.selectedItemId
      : items[0].id;
  return { items, selectedItemId };
}

function createFolder(name = "기본 폴더", parentId: string | null = null): WorkLogFolder {
  const now = nowIso();
  return {
    id: createFolderId(),
    name,
    parentId,
    createdAt: now,
    updatedAt: now
  };
}

function createEntry(folderId: string): WorkLogEntry {
  const now = nowIso();
  return {
    id: createEntryId(),
    folderId,
    sortOrder: Date.now(),
    title: "",
    type: "태스크",
    date: todayIsoDate(),
    durationWeeks: 0,
    durationDays: 1,
    context: "",
    result: "",
    metrics: "",
    tags: "",
    createdAt: now,
    updatedAt: now
  };
}

function initialState(): WorkLogState {
  const root = createFolder("기본 폴더", null);
  const firstEntry = createEntry(root.id);
  return {
    folders: [root],
    entries: [firstEntry],
    selection: { kind: "entry", id: firstEntry.id },
    collapsedFolderIds: [],
    organizedDraft: "",
    folderOrganizedDraft: ""
  };
}

function toMonth(dateIso: string) {
  const month = Number(dateIso.slice(5, 7));
  return Number.isNaN(month) ? 1 : month;
}

function inSeason(entry: WorkLogEntry, season: WorkLogSeason) {
  if (season === "all") return true;
  const month = toMonth(entry.date);
  if (season === "h1") return month >= 1 && month <= 6;
  return month >= 7 && month <= 12;
}

function collectDescendantFolderIds(folderId: string, folders: WorkLogFolder[]) {
  const byParent = new Map<string, string[]>();
  for (const folder of folders) {
    if (!folder.parentId) continue;
    const current = byParent.get(folder.parentId) ?? [];
    current.push(folder.id);
    byParent.set(folder.parentId, current);
  }

  const ids = new Set<string>([folderId]);
  const stack = [folderId];
  while (stack.length) {
    const current = stack.pop()!;
    const children = byParent.get(current) ?? [];
    for (const childId of children) {
      if (!ids.has(childId)) {
        ids.add(childId);
        stack.push(childId);
      }
    }
  }
  return ids;
}

export function WorkLogManager() {
  const { state, setState, isHydrated } = useLocalStorageState<WorkLogState>(
    WORK_LOG_STORAGE_KEY,
    initialState()
  );

  const [seasonYear, setSeasonYear] = useState(new Date().getFullYear());
  const [season, setSeason] = useState<WorkLogSeason>("all");
  const [folderSortOrder, setFolderSortOrder] = useState<FolderSortOrder>("default");
  const [folderRenameName, setFolderRenameName] = useState("");
  const [topTab, setTopTab] = useState<TopTab>("work-log");
  const [candidateApplyMessage, setCandidateApplyMessage] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [candidateOverrides, setCandidateOverrides] = useState<Record<string, Partial<Track1Form>>>({});
  const [candidateChats, setCandidateChats] = useState<Record<string, CandidateChatState>>({});
  const [candidateChatInput, setCandidateChatInput] = useState("");
  const [coachLoadingCandidateId, setCoachLoadingCandidateId] = useState<string | null>(null);
  const [candidateCoachError, setCandidateCoachError] = useState("");
  const [candidateSubTasks, setCandidateSubTasks] = useState<Record<string, SubTaskCard[]>>({});
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [draggingEntryId, setDraggingEntryId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dragOverSlotKey, setDragOverSlotKey] = useState<string | null>(null);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [organizeError, setOrganizeError] = useState("");
  const [isFolderOrganizing, setIsFolderOrganizing] = useState(false);
  const [folderOrganizeError, setFolderOrganizeError] = useState("");
  const [copied, setCopied] = useState(false);
  const [folderCopied, setFolderCopied] = useState(false);
  const previewEntriesSnapshotRef = useRef<WorkLogEntry[] | null>(null);
  const previousTopTabRef = useRef<TopTab>("work-log");
  const evaluationSettings = useEvaluationSettings();

  const folderMap = useMemo(() => new Map(state.folders.map((folder) => [folder.id, folder])), [state.folders]);

  const foldersByParent = useMemo(() => {
    const map = new Map<string | null, WorkLogFolder[]>();
    for (const folder of state.folders) {
      const list = map.get(folder.parentId) ?? [];
      list.push(folder);
      map.set(folder.parentId, list);
    }
    for (const [key, list] of map.entries()) {
      map.set(key, sortFolders(list, folderSortOrder));
    }
    return map;
  }, [folderSortOrder, state.folders]);

  const entriesByFolder = useMemo(() => {
    const map = new Map<string, WorkLogEntry[]>();
    for (const entry of state.entries) {
      const folderId = entry.folderId ?? "";
      const list = map.get(folderId) ?? [];
      list.push(entry);
      map.set(folderId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return timeValue(a.updatedAt) - timeValue(b.updatedAt);
      });
    }
    return map;
  }, [state.entries]);

  const selectedEntry =
    state.selection.kind === "entry"
      ? state.entries.find((entry) => entry.id === state.selection.id)
      : undefined;
  const selectedEntryPeriod = useMemo(() => {
    if (!selectedEntry) return null;
    return calculateWorkPeriod(selectedEntry.date, selectedEntry.durationWeeks, selectedEntry.durationDays);
  }, [selectedEntry]);
  const selectedFolder =
    state.selection.kind === "folder"
      ? state.folders.find((folder) => folder.id === state.selection.id)
      : selectedEntry
        ? selectedEntry.folderId
          ? folderMap.get(selectedEntry.folderId)
          : undefined
        : undefined;
  const focusFolderId = selectedFolder?.id ?? state.folders[0]?.id ?? null;
  const collapsedFolderIds = state.collapsedFolderIds ?? [];

  useEffect(() => {
    const folderIds = new Set(state.folders.map((folder) => folder.id));
    const hasNoFolder = state.folders.length === 0;
    const hasInvalidEntryFolder =
      state.entries.length > 0 &&
      state.entries.some((entry) => !entry.folderId || !folderIds.has(entry.folderId));
    const hasNoEntry = state.entries.length === 0;
    const hasInvalidSortOrder =
      state.entries.length > 0 && state.entries.some((entry) => Number.isNaN(Number(entry.sortOrder)));
    const collapsedInvalid =
      !Array.isArray((state as WorkLogState & { collapsedFolderIds?: unknown }).collapsedFolderIds);
    const selectionInvalid =
      state.selection.kind === "entry"
        ? !state.entries.some((entry) => entry.id === state.selection.id)
        : !state.folders.some((folder) => folder.id === state.selection.id);

    if (
      !hasNoFolder &&
      !hasInvalidEntryFolder &&
      !hasNoEntry &&
      !hasInvalidSortOrder &&
      !selectionInvalid &&
      !collapsedInvalid
    ) {
      return;
    }

    setState((prev) => {
      let folders = [...prev.folders];
      let entries = [...prev.entries];
      let selection: WorkLogSelection = { ...prev.selection };

      if (!folders.length) {
        folders = [createFolder("기본 폴더", null)];
      }

      const validFolderIds = new Set(folders.map((folder) => folder.id));
      const fallbackFolderId = folders[0].id;

      entries = entries.map((entry) =>
        !entry.folderId || !validFolderIds.has(entry.folderId)
          ? {
              ...entry,
              folderId: fallbackFolderId,
              sortOrder: Number.isNaN(Number(entry.sortOrder)) ? Date.now() : Number(entry.sortOrder),
              durationWeeks: normalizeDurationValue(
                (entry as WorkLogEntry & { durationWeeks?: number }).durationWeeks,
                0
              ),
              durationDays: normalizeDurationValue(
                (entry as WorkLogEntry & { durationDays?: number }).durationDays,
                1
              ),
              updatedAt: nowIso()
            }
          : {
              ...entry,
              sortOrder: Number.isNaN(Number(entry.sortOrder)) ? Date.now() : Number(entry.sortOrder),
              durationWeeks: normalizeDurationValue(
                (entry as WorkLogEntry & { durationWeeks?: number }).durationWeeks,
                0
              ),
              durationDays: normalizeDurationValue(
                (entry as WorkLogEntry & { durationDays?: number }).durationDays,
                1
              )
            }
      );

      if (!entries.length) {
        entries = [createEntry(fallbackFolderId)];
      }

      if (selection.kind === "entry") {
        if (!entries.some((entry) => entry.id === selection.id)) {
          selection = { kind: "entry", id: entries[0].id };
        }
      } else if (!folders.some((folder) => folder.id === selection.id)) {
        selection = { kind: "entry", id: entries[0].id };
      }

      return {
        ...prev,
        folders,
        entries,
        collapsedFolderIds: Array.isArray(prev.collapsedFolderIds) ? prev.collapsedFolderIds : [],
        folderOrganizedDraft:
          typeof (prev as WorkLogState & { folderOrganizedDraft?: unknown }).folderOrganizedDraft === "string"
            ? prev.folderOrganizedDraft
            : "",
        selection
      };
    });
  }, [setState, state.entries, state.folders, state.selection]);

  useEffect(() => {
    if (!focusFolderId) {
      setFolderRenameName("");
      return;
    }
    const folder = folderMap.get(focusFolderId);
    setFolderRenameName(folder?.name ?? "");
  }, [focusFolderId, folderMap]);

  useEffect(() => {
    const prevTopTab = previousTopTabRef.current;
    if (topTab === "track1-preview" && prevTopTab !== "track1-preview") {
      previewEntriesSnapshotRef.current = cloneEntries(state.entries);
    }

    if (topTab !== "track1-preview" && prevTopTab === "track1-preview") {
      const snapshot = previewEntriesSnapshotRef.current;
      if (snapshot && !entriesEqualForPreviewGuard(state.entries, snapshot)) {
        setState((prev) => ({
          ...prev,
          entries: cloneEntries(snapshot)
        }));
      }
      previewEntriesSnapshotRef.current = null;
    }

    previousTopTabRef.current = topTab;
  }, [setState, state.entries, topTab]);

  const yearOptions = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]);
    for (const entry of state.entries) {
      const y = Number(entry.date.slice(0, 4));
      if (!Number.isNaN(y)) years.add(y);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [state.entries]);

  const filteredEntries = useMemo(
    () =>
      state.entries.filter((entry) => {
        const y = Number(entry.date.slice(0, 4));
        return y === seasonYear && inSeason(entry, season);
      }),
    [seasonYear, season, state.entries]
  );

  const filteredFolderEntries = useMemo(() => {
    if (!focusFolderId) return [];
    const folderIds = collectDescendantFolderIds(focusFolderId, state.folders);
    return filteredEntries.filter((entry) => !!entry.folderId && folderIds.has(entry.folderId));
  }, [filteredEntries, focusFolderId, state.folders]);

  const focusFolderName = useMemo(() => {
    if (!focusFolderId) return "선택 폴더 없음";
    return folderMap.get(focusFolderId)?.name ?? "선택 폴더 없음";
  }, [focusFolderId, folderMap]);

  const track1Candidates = useMemo<Track1Candidate[]>(() => {
    const totalSourceCount = Math.max(1, filteredEntries.length);
    const groups = new Map<
      string,
      {
        sourceFolderId: string | null;
        goalCategory: string;
        contexts: string[];
        titles: string[];
        results: string[];
        metrics: string[];
        tags: string[];
        types: WorkLogType[];
        sourceEntryCount: number;
        sourceEntryIds: string[];
        minStartDate: string | null;
        maxEndDate: string | null;
      }
    >();

    for (const folder of state.folders) {
      groups.set(folder.id, {
        sourceFolderId: folder.id,
        goalCategory: folder.name,
        contexts: [],
        titles: [],
        results: [],
        metrics: [],
        tags: [],
        types: [],
        sourceEntryCount: 0,
        sourceEntryIds: [],
        minStartDate: null,
        maxEndDate: null
      });
    }

    for (const entry of filteredEntries) {
      const title = normalizeEntryText(entry.title) || `${entry.type} 업무`;
      const sourceFolderId = entry.folderId ?? null;
      const folderKey = sourceFolderId ?? "__uncategorized__";
      const folderName = sourceFolderId ? folderMap.get(sourceFolderId)?.name ?? "기본 폴더" : "기본 폴더";
      const groupKey = folderKey;
      const current = groups.get(groupKey) ?? {
        sourceFolderId,
        goalCategory: folderName,
        contexts: [],
        titles: [],
        results: [],
        metrics: [],
        tags: [],
        types: [],
        sourceEntryCount: 0,
        sourceEntryIds: [],
        minStartDate: null,
        maxEndDate: null
      };

      current.sourceEntryCount += 1;
      current.sourceEntryIds.push(entry.id);

      const context = normalizeEntryText(entry.context);
      const result = normalizeEntryText(entry.result);
      const metric = normalizeEntryText(entry.metrics);
      const tags = splitTags(normalizeEntryText(entry.tags));
      current.titles.push(title);
      current.types.push(entry.type);
      if (context) current.contexts.push(context);
      if (result) current.results.push(result);
      if (metric) current.metrics.push(metric);
      current.tags.push(...tags);

      const period = calculateWorkPeriod(entry.date, entry.durationWeeks, entry.durationDays);
      if (period) {
        if (!current.minStartDate || period.startDate < current.minStartDate) {
          current.minStartDate = period.startDate;
        }
        if (!current.maxEndDate || period.endDate > current.maxEndDate) {
          current.maxEndDate = period.endDate;
        }
      } else {
        const fallbackDate = entry.date || todayIsoDate();
        if (!current.minStartDate || fallbackDate < current.minStartDate) {
          current.minStartDate = fallbackDate;
        }
        if (!current.maxEndDate || fallbackDate > current.maxEndDate) {
          current.maxEndDate = fallbackDate;
        }
      }

      groups.set(groupKey, current);
    }

    const candidates: Track1Candidate[] = [];
    for (const [key, group] of groups.entries()) {
      if (group.sourceEntryCount === 0) continue;
      const uniqueTags = uniqueList(group.tags);
      const uniqueContexts = uniqueList(group.contexts);
      const uniqueResults = uniqueList(group.results);
      const uniqueMetrics = uniqueList(group.metrics);
      const uniqueTitles = uniqueList(group.titles);
      const periodLabel =
        group.minStartDate && group.maxEndDate
          ? `${group.minStartDate} ~ ${group.maxEndDate}`
          : group.maxEndDate || group.minStartDate || "-";
      const contextLabel = inferKpiTask(uniqueTitles, uniqueContexts);
      const sourceType = group.types[0] ?? "태스크";
      const roleAndResponsibilities = inferRoleAndResponsibilities(uniqueTags, uniqueTitles, group.goalCategory);
      const kpiFormula = inferKpiFormula(uniqueMetrics, sourceType);
      const achievementPlan = inferAchievementPlan(periodLabel, uniqueTitles, uniqueContexts);
      const calculatedGoalWeight = roundToNearestStep((group.sourceEntryCount / totalSourceCount) * 100, 5);
      const goalTaskWeight = Math.min(100, Math.max(5, calculatedGoalWeight || 5));
      const kpiName = uniqueTitles[0] || `${group.goalCategory} 핵심 KPI`;

      candidates.push({
        id: `candidate-${key}`,
        goalCategory: group.goalCategory,
        roleAndResponsibilities,
        goalTaskWeight,
        kpiName,
        kpiTask: contextLabel || kpiName,
        achievementPlan,
        kpiFormula,
        subTaskWeight: "",
        grade: "달성",
        score: PERFORMANCE_GRADE_SCORES["달성"],
        achievementResult: "",
        sourceEntryCount: group.sourceEntryCount,
        sourcePeriod: periodLabel,
        sourceFolderLabel: group.goalCategory,
        sourceFolderId: group.sourceFolderId,
        sourceEntryIds: uniqueList(group.sourceEntryIds),
        sourceType
      });
    }

    return candidates.sort((a, b) => {
      if (a.goalCategory !== b.goalCategory) return a.goalCategory.localeCompare(b.goalCategory, "ko");
      return b.sourceEntryCount - a.sourceEntryCount;
    });
  }, [filteredEntries, folderMap, state.folders]);

  const resolvedTrack1Candidates = useMemo(
    () =>
      track1Candidates.map((candidate) => {
        const override = candidateOverrides[candidate.id] ?? {};
        const grade = (override.grade ?? candidate.grade) as Track1Form["grade"];
        const score = override.score ?? PERFORMANCE_GRADE_SCORES[grade];
        return {
          ...candidate,
          ...override,
          grade,
          score
        };
      }),
    [candidateOverrides, track1Candidates]
  );

  const candidateMap = useMemo(
    () => new Map(resolvedTrack1Candidates.map((candidate) => [candidate.id, candidate])),
    [resolvedTrack1Candidates]
  );

  const selectedCandidate = selectedCandidateId ? candidateMap.get(selectedCandidateId) ?? null : null;

  const entryMap = useMemo(() => new Map(state.entries.map((entry) => [entry.id, entry])), [state.entries]);
  const selectedCandidateEntries = useMemo(() => {
    if (!selectedCandidate) return [];
    return selectedCandidate.sourceEntryIds
      .map((entryId) => entryMap.get(entryId))
      .filter((entry): entry is WorkLogEntry => !!entry);
  }, [entryMap, selectedCandidate]);

  useEffect(() => {
    if (!resolvedTrack1Candidates.length) {
      setSelectedCandidateId(null);
      return;
    }
    if (!selectedCandidateId || !candidateMap.has(selectedCandidateId)) {
      setSelectedCandidateId(resolvedTrack1Candidates[0].id);
    }
  }, [candidateMap, resolvedTrack1Candidates, selectedCandidateId]);

  useEffect(() => {
    if (!selectedCandidateId) return;
    if (candidateSubTasks[selectedCandidateId]) {
      // already initialized – just set expandedCardId to first card
      const existing = candidateSubTasks[selectedCandidateId];
      setExpandedCardId(existing[0]?.id ?? null);
      return;
    }
    const entries = selectedCandidateEntries;
    const cards: SubTaskCard[] = entries.length
      ? entries.map((entry) => {
          const metric = normalizeEntryText(entry.metrics);
          return {
            id: createSubTaskCardId(),
            kpiName: entry.title || `${entry.type} 업무`,
            kpiTask: normalizeEntryText(entry.context) || entry.title || "핵심 과업 실행",
            achievementPlan: normalizeEntryText(entry.result) || "",
            kpiFormula: metric
              ? hasGradeThresholdScale(metric)
                ? metric
                : `${metric}\n${gradeThresholdScaleBlock()}`
              : inferKpiFormula([], entry.type),
            subTaskWeight: "",
            locked: false,
          };
        })
      : [
          {
            id: createSubTaskCardId(),
            kpiName: "",
            kpiTask: "",
            achievementPlan: "",
            kpiFormula: inferKpiFormula([], "태스크"),
            subTaskWeight: "",
            locked: false,
          },
        ];
    setCandidateSubTasks((prev) => ({ ...prev, [selectedCandidateId]: cards }));
    setExpandedCardId(cards[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCandidateId, selectedCandidateEntries]);

  const selectedSubTasks = selectedCandidateId ? candidateSubTasks[selectedCandidateId] ?? [] : [];

  const selectedCandidateChat = selectedCandidateId ? candidateChats[selectedCandidateId] : undefined;
  const autoCandidateProgress = useMemo<CandidateProgress>(() => {
    if (!selectedCandidate) return baseProgress();
    const baselineConfirmed =
      selectedCandidate.sourceEntryCount > 0 && normalizeEntryText(selectedCandidate.kpiTask).length >= 8;
    const formulaText = normalizeEntryText(selectedCandidate.kpiFormula);
    const formulaConfirmed = formulaText.length > 0 && hasGradeThresholdScale(formulaText);
    const targetConfirmed = hasTargetSignal(
      `${selectedCandidate.kpiFormula} ${selectedCandidate.achievementPlan} ${
        selectedCandidate.goalTaskWeight === "" ? "" : selectedCandidate.goalTaskWeight
      }`
    );
    return {
      baselineConfirmed,
      formulaConfirmed,
      targetConfirmed,
      readyToApply: baselineConfirmed && formulaConfirmed && targetConfirmed
    };
  }, [selectedCandidate]);

  const mergedCandidateProgress = useMemo(
    () => mergeCandidateProgress(autoCandidateProgress, selectedCandidateChat?.progress),
    [autoCandidateProgress, selectedCandidateChat?.progress]
  );

  const folderOptions = useMemo(() => {
    const output: Array<{ id: string; label: string }> = [];
    const walk = (parentId: string | null, depth: number) => {
      const children = foldersByParent.get(parentId) ?? [];
      for (const folder of children) {
        output.push({ id: folder.id, label: `${"— ".repeat(depth)}${folder.name}` });
        walk(folder.id, depth + 1);
      }
    };
    walk(null, 0);
    return output;
  }, [foldersByParent]);

  const setField = <K extends keyof WorkLogEntry>(key: K, value: WorkLogEntry[K]) => {
    setState((prev) => ({
      ...prev,
      entries: prev.entries.map((entry) =>
        entry.id === prev.selection.id ? { ...entry, [key]: value, updatedAt: nowIso() } : entry
      )
    }));
  };

  const addFolder = (parentId: string | null) => {
    setState((prev) => {
      const created = createFolder(`새 폴더 ${prev.folders.length + 1}`, parentId);
      return {
        ...prev,
        folders: [...prev.folders, created],
        selection: { kind: "folder", id: created.id }
      };
    });
  };

  const renameFocusedFolder = () => {
    if (!focusFolderId) return;
    const nextName = folderRenameName.trim();
    if (!nextName) return;
    setState((prev) => ({
      ...prev,
      folders: prev.folders.map((folder) =>
        folder.id === focusFolderId ? { ...folder, name: nextName, updatedAt: nowIso() } : folder
      )
    }));
  };

  const toggleFolderCollapsed = (folderId: string) => {
    setState((prev) => {
      const current = prev.collapsedFolderIds ?? [];
      const next = current.includes(folderId)
        ? current.filter((id) => id !== folderId)
        : [...current, folderId];
      return { ...prev, collapsedFolderIds: next };
    });
  };

  const addEntry = (folderId?: string | null) => {
    const targetFolderId = folderId ?? focusFolderId ?? state.folders[0]?.id;
    if (!targetFolderId) return;
    const created = createEntry(targetFolderId);
    setState((prev) => ({
      ...prev,
      entries: [...prev.entries, created],
      selection: { kind: "entry", id: created.id }
    }));
  };

  const deleteSelectedEntry = () => {
    if (!selectedEntry) return;
    setState((prev) => {
      const nextEntries = prev.entries.filter((entry) => entry.id !== selectedEntry.id);
      if (!nextEntries.length) {
        const folderId = prev.folders[0]?.id;
        if (!folderId) return prev;
        const created = createEntry(folderId);
        return {
          ...prev,
          entries: [created],
          selection: { kind: "entry", id: created.id }
        };
      }
      return {
        ...prev,
        entries: nextEntries,
        selection: { kind: "entry", id: nextEntries[0].id }
      };
    });
  };

  const deleteSelectedFolder = () => {
    if (state.selection.kind !== "folder" || !state.selection.id) return;
    setState((prev) => {
      const selectedFolderId = prev.selection.id;
      if (!selectedFolderId) return prev;
      const removingIds = collectDescendantFolderIds(selectedFolderId, prev.folders);

      let nextFolders = prev.folders.filter((folder) => !removingIds.has(folder.id));
      let fallbackFolderId: string;
      if (!nextFolders.length) {
        const recreated = createFolder("기본 폴더", null);
        nextFolders = [recreated];
        fallbackFolderId = recreated.id;
      } else {
        fallbackFolderId = nextFolders[0].id;
      }

      const nextEntries = prev.entries.map((entry) =>
        entry.folderId && removingIds.has(entry.folderId)
          ? { ...entry, folderId: fallbackFolderId, updatedAt: nowIso() }
          : entry
      );

      return {
        ...prev,
        folders: nextFolders,
        entries: nextEntries,
        collapsedFolderIds: (prev.collapsedFolderIds ?? []).filter((id) => !removingIds.has(id)),
        selection: { kind: "entry", id: nextEntries[0]?.id ?? null }
      };
    });
  };

  const moveEntryToPosition = (entryId: string, targetFolderId: string, insertIndex: number) => {
    setState((prev) => {
      const targetExists = prev.folders.some((folder) => folder.id === targetFolderId);
      if (!targetExists) return prev;

      const movingEntry = prev.entries.find((entry) => entry.id === entryId);
      if (!movingEntry || !movingEntry.folderId) return prev;
      const sourceFolderId = movingEntry.folderId;

      const sortedIdsByFolder = (folderId: string, excludingId: string) =>
        prev.entries
          .filter((entry) => entry.folderId === folderId && entry.id !== excludingId)
          .sort((a, b) => {
            if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
            return timeValue(a.updatedAt) - timeValue(b.updatedAt);
          })
          .map((entry) => entry.id);

      const sourceIds = sortedIdsByFolder(sourceFolderId, entryId);
      const targetBaseIds =
        sourceFolderId === targetFolderId ? sourceIds : sortedIdsByFolder(targetFolderId, entryId);
      const targetIds = [...targetBaseIds];
      const clampedIndex = Math.max(0, Math.min(insertIndex, targetIds.length));
      targetIds.splice(clampedIndex, 0, entryId);

      const orderMap = new Map<string, number>();
      if (sourceFolderId !== targetFolderId) {
        sourceIds.forEach((id, index) => orderMap.set(id, index + 1));
      }
      targetIds.forEach((id, index) => orderMap.set(id, index + 1));

      const now = nowIso();

      return {
        ...prev,
        entries: prev.entries.map((entry) =>
          orderMap.has(entry.id) || entry.id === entryId
            ? {
                ...entry,
                folderId: entry.id === entryId ? targetFolderId : entry.folderId,
                sortOrder: orderMap.get(entry.id) ?? entry.sortOrder,
                updatedAt: now
              }
            : entry
        ),
        selection: { kind: "entry", id: entryId }
      };
    });
  };

  const moveEntryToFolder = (entryId: string, targetFolderId: string) => {
    const targetEntries = entriesByFolder.get(targetFolderId) ?? [];
    moveEntryToPosition(entryId, targetFolderId, targetEntries.length);
  };

  const organizeSeason = async () => {
    if (isOrganizing) return;
    if (!filteredEntries.length) {
      setOrganizeError("선택한 시즌에 해당하는 기록이 없습니다.");
      return;
    }

    setOrganizeError("");
    setIsOrganizing(true);

    try {
      const response = await fetch("/api/work-log/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: seasonYear,
          season,
          entries: filteredEntries,
          geminiApiKey: evaluationSettings.geminiApiKey || undefined,
          geminiModel: evaluationSettings.geminiModel || undefined
        })
      });

      const data = (await response.json()) as { draft?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "시즌 정리 요청에 실패했습니다.");

      setState((prev) => ({ ...prev, organizedDraft: (data.draft || "").trim() }));
      setTopTab("overall-review");
    } catch (error) {
      setOrganizeError(error instanceof Error ? error.message : "알 수 없는 오류");
    } finally {
      setIsOrganizing(false);
    }
  };

  const organizeFolderSeason = async () => {
    if (isFolderOrganizing) return;
    if (!focusFolderId) {
      setFolderOrganizeError("폴더를 먼저 선택해 주세요.");
      return;
    }
    if (!filteredFolderEntries.length) {
      setFolderOrganizeError("선택 폴더(하위 포함)에 해당 시즌 기록이 없습니다.");
      return;
    }

    setFolderOrganizeError("");
    setIsFolderOrganizing(true);

    try {
      const response = await fetch("/api/work-log/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: seasonYear,
          season,
          entries: filteredFolderEntries,
          geminiApiKey: evaluationSettings.geminiApiKey || undefined,
          geminiModel: evaluationSettings.geminiModel || undefined
        })
      });

      const data = (await response.json()) as { draft?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "폴더 정리 요청에 실패했습니다.");

      setState((prev) => ({ ...prev, folderOrganizedDraft: (data.draft || "").trim() }));
      setTopTab("work-log");
    } catch (error) {
      setFolderOrganizeError(error instanceof Error ? error.message : "알 수 없는 오류");
    } finally {
      setIsFolderOrganizing(false);
    }
  };

  const copyDraft = async () => {
    if (!state.organizedDraft.trim()) return;
    try {
      await navigator.clipboard.writeText(state.organizedDraft);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setOrganizeError("클립보드 복사에 실패했습니다.");
    }
  };

  const copyFolderDraft = async () => {
    const draft = state.folderOrganizedDraft ?? "";
    if (!draft.trim()) return;
    try {
      await navigator.clipboard.writeText(draft);
      setFolderCopied(true);
      window.setTimeout(() => setFolderCopied(false), 1400);
    } catch {
      setFolderOrganizeError("클립보드 복사에 실패했습니다.");
    }
  };

  const setCandidateField = <K extends keyof Track1Form>(candidateId: string, key: K, value: Track1Form[K]) => {
    setCandidateOverrides((prev) => ({
      ...prev,
      [candidateId]: {
        ...(prev[candidateId] ?? {}),
        [key]: value
      }
    }));
  };

  const setSubTaskCardField = (
    candidateId: string,
    cardId: string,
    key: keyof Omit<SubTaskCard, "id">,
    value: string | number | ""
  ) => {
    setCandidateSubTasks((prev) => {
      const cards = prev[candidateId];
      if (!cards) return prev;
      return {
        ...prev,
        [candidateId]: cards.map((c) => (c.id === cardId ? { ...c, [key]: value } : c)),
      };
    });
  };

  const addSubTaskCard = (candidateId: string) => {
    const newId = createSubTaskCardId();
    setCandidateSubTasks((prev) => ({
      ...prev,
      [candidateId]: [
        ...(prev[candidateId] ?? []),
        {
          id: newId,
          kpiName: "",
          kpiTask: "",
          achievementPlan: "",
          kpiFormula: inferKpiFormula([], "태스크"),
          subTaskWeight: "",
          locked: false,
        },
      ],
    }));
    setExpandedCardId(newId);
  };

  const toggleSubTaskLock = (candidateId: string, cardId: string) => {
    setCandidateSubTasks((prev) => {
      const cards = prev[candidateId];
      if (!cards) return prev;
      return {
        ...prev,
        [candidateId]: cards.map((c) =>
          c.id === cardId ? { ...c, locked: !c.locked } : c
        ),
      };
    });
  };

  const removeSubTaskCard = (candidateId: string, cardId: string) => {
    setCandidateSubTasks((prev) => {
      const cards = prev[candidateId];
      if (!cards || cards.length <= 1) return prev; // keep at least 1 card
      return {
        ...prev,
        [candidateId]: cards.filter((c) => c.id !== cardId),
      };
    });
  };

  const applySuggestedUpdates = (candidateId: string, updates: Partial<Track1Form>) => {
    if (!updates || !Object.keys(updates).length) return;
    setCandidateOverrides((prev) => {
      const current = prev[candidateId] ?? {};
      const next: Partial<Track1Form> = { ...current };

      const applyTextField = (
        key:
          | "goalCategory"
          | "roleAndResponsibilities"
          | "kpiName"
          | "kpiTask"
          | "achievementPlan"
          | "kpiFormula"
          | "achievementResult"
      ) => {
        const updateValue = updates[key];
        if (typeof updateValue !== "string") return;
        if (!normalizeEntryText(updateValue)) return;
        next[key] = updateValue;
      };

      applyTextField("goalCategory");
      applyTextField("kpiName");
      applyTextField("roleAndResponsibilities");
      applyTextField("kpiTask");
      applyTextField("achievementPlan");
      applyTextField("kpiFormula");

      if (typeof updates.goalTaskWeight === "number") {
        next.goalTaskWeight = Math.max(0, Math.min(100, updates.goalTaskWeight));
      }
      if (typeof updates.subTaskWeight === "number") {
        next.subTaskWeight = Math.max(0, Math.min(100, updates.subTaskWeight));
      }

      if (updates.grade) {
        next.grade = updates.grade;
        next.score =
          typeof updates.score === "number" && Number.isFinite(updates.score)
            ? updates.score
            : PERFORMANCE_GRADE_SCORES[updates.grade];
      } else if (typeof updates.score === "number" && Number.isFinite(updates.score)) {
        next.score = updates.score;
      }

      return {
        ...prev,
        [candidateId]: next
      };
    });
  };

  const requestCandidateCoach = async (candidateId: string, userMessage: string, mode: "kickoff" | "chat") => {
    const candidate = candidateMap.get(candidateId);
    if (!candidate) return;

    // Overlay active card data onto candidate for scoped coaching
    const cards = candidateSubTasks[candidateId] ?? [];
    const activeCard = expandedCardId ? cards.find((c) => c.id === expandedCardId) : null;
    const candidatePayload = activeCard
      ? {
          ...candidate,
          kpiName: activeCard.kpiName || candidate.kpiName,
          kpiTask: activeCard.kpiTask || candidate.kpiTask,
          achievementPlan: activeCard.achievementPlan || candidate.achievementPlan,
          kpiFormula: activeCard.kpiFormula || candidate.kpiFormula,
          subTaskWeight: activeCard.subTaskWeight,
        }
      : candidate;

    const existingChat = candidateChats[candidateId];
    const existingMessages = existingChat?.messages ?? [];
    const trimmedUserMessage = userMessage.trim();
    const relatedEntries = candidate.sourceEntryIds
      .map((entryId) => entryMap.get(entryId))
      .filter((entry): entry is WorkLogEntry => !!entry);

    if (mode === "chat" && !trimmedUserMessage) return;

    const userChatMessage = mode === "chat" ? makeMessage("user", trimmedUserMessage) : null;
    const nextMessagesForRequest = userChatMessage ? [...existingMessages, userChatMessage] : existingMessages;

    if (userChatMessage) {
      setCandidateChats((prev) => ({
        ...prev,
        [candidateId]: {
          messages: nextMessagesForRequest,
          progress: prev[candidateId]?.progress ?? baseProgress()
        }
      }));
    }

    setCoachLoadingCandidateId(candidateId);
    setCandidateCoachError("");

    try {
      const response = await fetch("/api/work-log/candidate-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          userMessage: trimmedUserMessage,
          candidate: candidatePayload,
          entries: relatedEntries,
          messages: nextMessagesForRequest.map((message) => ({
            role: message.role,
            content: message.content
          })),
          geminiApiKey: evaluationSettings.geminiApiKey || undefined,
          geminiModel: evaluationSettings.geminiModel || undefined
        })
      });

      const data = (await response.json()) as { error?: string } & CandidateCoachResponse;
      if (!response.ok) throw new Error(data.error || "후보 상담 요청에 실패했습니다.");
      if (!data.reply?.trim()) throw new Error("상담 응답이 비어 있습니다.");

      const assistantMessage = makeMessage("assistant", data.reply);
      const progressPatch = data.progress ?? {};

      setCandidateChats((prev) => {
        const base = prev[candidateId] ?? { messages: [], progress: baseProgress() };
        const lastBaseMessage = base.messages[base.messages.length - 1];
        const needsUserAppend =
          !!userChatMessage &&
          (!lastBaseMessage ||
            lastBaseMessage.role !== "user" ||
            lastBaseMessage.content !== userChatMessage.content);
        const baseMessages = needsUserAppend ? [...base.messages, userChatMessage!] : base.messages;
        return {
          ...prev,
          [candidateId]: {
            messages: [...baseMessages, assistantMessage],
            progress: mergeCandidateProgress(base.progress, progressPatch)
          }
        };
      });

      if (data.suggestedUpdates) {
        applySuggestedUpdates(candidateId, data.suggestedUpdates);
        // Apply card-level fields to the active unlocked card
        if (activeCard && !activeCard.locked) {
          const su = data.suggestedUpdates;
          setCandidateSubTasks((prev) => {
            const list = prev[candidateId];
            if (!list) return prev;
            return {
              ...prev,
              [candidateId]: list.map((c) => {
                if (c.id !== activeCard.id) return c;
                const patched = { ...c };
                if (typeof su.kpiName === "string" && su.kpiName.trim()) patched.kpiName = su.kpiName;
                if (typeof su.kpiTask === "string" && su.kpiTask.trim()) patched.kpiTask = su.kpiTask;
                if (typeof su.achievementPlan === "string" && su.achievementPlan.trim())
                  patched.achievementPlan = su.achievementPlan;
                if (typeof su.kpiFormula === "string" && su.kpiFormula.trim()) patched.kpiFormula = su.kpiFormula;
                if (typeof su.subTaskWeight === "number") patched.subTaskWeight = Math.max(0, Math.min(100, su.subTaskWeight));
                return patched;
              }),
            };
          });
        }
      }
    } catch (error) {
      setCandidateCoachError(error instanceof Error ? error.message : "상담 중 오류가 발생했습니다.");
    } finally {
      setCoachLoadingCandidateId(null);
    }
  };

  const sendCandidateChat = async () => {
    if (!selectedCandidateId) return;
    const message = candidateChatInput.trim();
    if (!message) return;
    setCandidateChatInput("");
    await requestCandidateCoach(selectedCandidateId, message, "chat");
  };

  const startCandidateCoach = async () => {
    if (!selectedCandidateId) return;
    await requestCandidateCoach(selectedCandidateId, "", "kickoff");
  };

  const selectCandidate = (candidateId: string) => {
    setSelectedCandidateId(candidateId);
    setCandidateCoachError("");
  };

  const appendCandidatesToTrack1 = (candidateIds: string[]) => {
    if (!candidateIds.length) return;
    const candidates = candidateIds
      .map((id) => candidateMap.get(id))
      .filter((c): c is Track1Candidate => !!c);
    if (!candidates.length) return;

    try {
      const raw = window.localStorage.getItem(TRACK1_STORAGE_KEY);
      const parsed = raw ? safeTrack1State(JSON.parse(raw)) : null;
      const currentItems = parsed?.items ?? [];
      const appended: Track1WizardItem[] = [];

      for (const candidate of candidates) {
        const cards = candidateSubTasks[candidate.id];
        if (cards && cards.length > 0) {
          for (const card of cards) {
            appended.push({
              id: createTrack1ItemId(),
              goalCategory: candidate.goalCategory,
              roleAndResponsibilities: candidate.roleAndResponsibilities,
              goalTaskWeight: candidate.goalTaskWeight,
              kpiName: card.kpiName || candidate.kpiName,
              kpiTask: card.kpiTask || candidate.kpiTask,
              achievementPlan: card.achievementPlan || candidate.achievementPlan,
              kpiFormula: card.kpiFormula || candidate.kpiFormula,
              subTaskWeight: card.subTaskWeight,
              grade: candidate.grade,
              achievementResult: "",
              score: candidate.score,
            });
          }
        } else {
          appended.push({
            id: createTrack1ItemId(),
            goalCategory: candidate.goalCategory,
            roleAndResponsibilities: candidate.roleAndResponsibilities,
            goalTaskWeight: candidate.goalTaskWeight,
            kpiName: candidate.kpiName,
            kpiTask: candidate.kpiTask,
            achievementPlan: candidate.achievementPlan,
            kpiFormula: candidate.kpiFormula,
            subTaskWeight: candidate.subTaskWeight,
            grade: candidate.grade,
            achievementResult: "",
            score: candidate.score,
          });
        }
      }

      const nextItems = [...currentItems, ...appended];
      if (!nextItems.length) return;
      const nextState: Track1WizardState = {
        items: nextItems,
        selectedItemId: appended[appended.length - 1]?.id ?? parsed?.selectedItemId ?? nextItems[0].id,
      };
      window.localStorage.setItem(TRACK1_STORAGE_KEY, JSON.stringify(nextState));
      setCandidateApplyMessage(`${appended.length}개 항목을 Track 1 입력폼에 추가했습니다.`);
      window.setTimeout(() => setCandidateApplyMessage(""), 1800);
    } catch (error) {
      console.error("Failed to append Track 1 candidates", error);
      setCandidateApplyMessage("Track 1 후보 저장 중 오류가 발생했습니다.");
    }
  };

  const refreshTrack1Preview = () => {
    setCandidateOverrides({});
    setCandidateSubTasks({});
    setExpandedCardId(null);
    setCandidateChats({});
    setCandidateChatInput("");
    setCandidateCoachError("");
    setSelectedCandidateId(null);
    setCandidateApplyMessage("업적 미리보기 후보를 최신 상시기록 기준으로 새로고침했습니다.");
    window.setTimeout(() => setCandidateApplyMessage(""), 1800);
  };

  const renderFolderNode = (folder: WorkLogFolder, depth: number) => {
    const childFolders = foldersByParent.get(folder.id) ?? [];
    const entries = entriesByFolder.get(folder.id) ?? [];
    const isSelected = state.selection.kind === "folder" && state.selection.id === folder.id;
    const isCollapsed = collapsedFolderIds.includes(folder.id);
    const folderGapKey = `folder-gap-${folder.id}`;

    return (
      <div key={folder.id} className="space-y-0">
        <div
          className={`rounded-sm transition ${dragOverSlotKey === folderGapKey ? "h-1.5 bg-blue-300/70 dark:bg-blue-500/60" : "h-1"}`}
          style={{ marginLeft: `${6 + depth * 14}px` }}
          onDragOver={(event) => {
            if (!draggingEntryId) return;
            event.preventDefault();
            setDragOverSlotKey(folderGapKey);
            setDragOverFolderId(null);
          }}
          onDragLeave={() => {
            if (dragOverSlotKey === folderGapKey) setDragOverSlotKey(null);
          }}
          onDrop={(event) => {
            if (!draggingEntryId) return;
            event.preventDefault();
            moveEntryToFolder(draggingEntryId, folder.id);
            setDragOverSlotKey(null);
            setDragOverFolderId(null);
            setDraggingEntryId(null);
          }}
        />
        <div
          className={`flex items-center gap-0.5 rounded-md border px-2 py-1 transition ${
            dragOverFolderId === folder.id
              ? "border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300"
              : isSelected
              ? "border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-300"
              : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          }`}
          style={{ paddingLeft: `${6 + depth * 14}px` }}
          onDragOver={(event) => {
            if (!draggingEntryId) return;
            event.preventDefault();
            setDragOverFolderId(folder.id);
            setDragOverSlotKey(null);
          }}
          onDragLeave={() => {
            if (dragOverFolderId === folder.id) setDragOverFolderId(null);
          }}
          onDrop={(event) => {
            if (!draggingEntryId) return;
            event.preventDefault();
            moveEntryToFolder(draggingEntryId, folder.id);
            setDragOverFolderId(null);
            setDragOverSlotKey(null);
            setDraggingEntryId(null);
          }}
        >
          <button
            type="button"
            onClick={() => toggleFolderCollapsed(folder.id)}
            className="inline-flex h-5 w-5 items-center justify-center rounded text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            aria-label={isCollapsed ? "폴더 펼치기" : "폴더 접기"}
            title={isCollapsed ? "펼치기" : "접기"}
          >
            {isCollapsed ? "▶" : "▼"}
          </button>
          <button
            type="button"
            onClick={() => setState((prev) => ({ ...prev, selection: { kind: "folder", id: folder.id } }))}
            className="flex-1 text-left text-[13px] font-semibold leading-5"
          >
            📁 {folder.name}
          </button>
        </div>

        {!isCollapsed && (
          <>
            <div
              className={`rounded-sm transition ${dragOverSlotKey === `${folder.id}:0` ? "h-1.5 bg-blue-300/70 dark:bg-blue-500/60" : "h-1"}`}
              style={{ marginLeft: `${28 + depth * 14}px` }}
              onDragOver={(event) => {
                if (!draggingEntryId) return;
                event.preventDefault();
                setDragOverSlotKey(`${folder.id}:0`);
                setDragOverFolderId(null);
              }}
              onDragLeave={() => {
                if (dragOverSlotKey === `${folder.id}:0`) setDragOverSlotKey(null);
              }}
              onDrop={(event) => {
                if (!draggingEntryId) return;
                event.preventDefault();
                moveEntryToPosition(draggingEntryId, folder.id, 0);
                setDragOverSlotKey(null);
                setDragOverFolderId(null);
                setDraggingEntryId(null);
              }}
            />
            {entries.map((entry, index) => {
              const isEntrySelected = state.selection.kind === "entry" && state.selection.id === entry.id;
              return (
                <Fragment key={entry.id}>
                  <button
                    type="button"
                    draggable
                    onDragStart={() => setDraggingEntryId(entry.id)}
                    onDragEnd={() => {
                      setDraggingEntryId(null);
                      setDragOverFolderId(null);
                      setDragOverSlotKey(null);
                    }}
                    onClick={() => setState((prev) => ({ ...prev, selection: { kind: "entry", id: entry.id } }))}
                    className={`w-full rounded-md border px-2 py-1 text-left transition ${
                      isEntrySelected
                        ? "border-blue-400 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/40"
                        : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                    }`}
                    style={{ paddingLeft: `${28 + depth * 14}px` }}
                  >
                    <p className="line-clamp-1 text-xs font-semibold leading-4 text-slate-900 dark:text-slate-100">
                      📝 {(entry.title ?? "").trim() || "제목 없음"}
                    </p>
                    <p className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                      {(entry.type ?? "태스크") as WorkLogType} · {entry.date ?? todayIsoDate()}
                    </p>
                  </button>
                  <div
                    className={`rounded-sm transition ${dragOverSlotKey === `${folder.id}:${index + 1}` ? "h-1.5 bg-blue-300/70 dark:bg-blue-500/60" : "h-1"}`}
                    style={{ marginLeft: `${28 + depth * 14}px` }}
                    onDragOver={(event) => {
                      if (!draggingEntryId) return;
                      event.preventDefault();
                      setDragOverSlotKey(`${folder.id}:${index + 1}`);
                      setDragOverFolderId(null);
                    }}
                    onDragLeave={() => {
                      if (dragOverSlotKey === `${folder.id}:${index + 1}`) setDragOverSlotKey(null);
                    }}
                    onDrop={(event) => {
                      if (!draggingEntryId) return;
                      event.preventDefault();
                      moveEntryToPosition(draggingEntryId, folder.id, index + 1);
                      setDragOverSlotKey(null);
                      setDragOverFolderId(null);
                      setDraggingEntryId(null);
                    }}
                  />
                </Fragment>
              );
            })}

            {childFolders.map((child) => renderFolderNode(child, depth + 1))}
          </>
        )}
      </div>
    );
  };

  const rootFolders = foldersByParent.get(null) ?? [];
  const isCandidateApplyError = candidateApplyMessage.includes("오류");

  return (
    <section className="rounded-3xl border border-indigo-100 bg-white p-6 shadow-card md:p-8 dark:border-indigo-900 dark:bg-slate-900/85">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5 dark:border-slate-700">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
            Main Menu
          </p>
          <h2 className="mt-1 text-xl font-bold text-brand-ink dark:text-slate-100">상시 기록 정리</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {isHydrated ? `폴더 ${state.folders.length}개 · 기록 ${state.entries.length}건` : "저장소 동기화 중"}
          </span>
          {isHydrated && (
            hasSampleData(state) ? (
              <button
                type="button"
                onClick={() => setState(removeSampleData)}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-900/50"
              >
                샘플 데이터 삭제
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setState(loadSampleData)}
                className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600 transition hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
              >
                샘플 데이터 불러오기
              </button>
            )
          )}
        </div>
      </div>

      <div className="mt-4 inline-flex rounded-xl border border-indigo-200 bg-white p-1 dark:border-indigo-900 dark:bg-slate-800">
        <button
          type="button"
          onClick={() => setTopTab("work-log")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            topTab === "work-log"
              ? "bg-indigo-600 text-white"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          상시 기록 정리
        </button>
        <button
          type="button"
          onClick={() => setTopTab("track1-preview")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            topTab === "track1-preview"
              ? "bg-indigo-600 text-white"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          업적 미리보기 후보
        </button>
        <button
          type="button"
          onClick={() => setTopTab("overall-review")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            topTab === "overall-review"
              ? "bg-indigo-600 text-white"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          전체 리뷰
        </button>
      </div>

      {topTab === "work-log" ? (
      <div className="mt-6 grid gap-5 lg:grid-cols-[340px_1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/60">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
              폴더 정렬
              <select
                value={folderSortOrder}
                onChange={(event) => setFolderSortOrder(event.target.value as FolderSortOrder)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm outline-none ring-indigo-500 focus:ring dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="default">기본</option>
                <option value="latest">최신순</option>
                <option value="updated">수정순</option>
                <option value="oldest">오래된 순</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => addFolder(null)}
                className="rounded-lg border border-indigo-300 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 dark:border-indigo-700 dark:bg-slate-800 dark:text-indigo-300 dark:hover:bg-slate-700"
              >
                + 루트 폴더
              </button>
              <button
                type="button"
                onClick={() => addFolder(focusFolderId)}
                disabled={!focusFolderId}
                className="rounded-lg border border-indigo-300 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-700 dark:bg-slate-800 dark:text-indigo-300 dark:hover:bg-slate-700"
              >
                + 하위 폴더
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => addEntry()}
                className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 dark:border-blue-700 dark:bg-slate-800 dark:text-blue-300 dark:hover:bg-slate-700"
              >
                + 기록 추가
              </button>
              <button
                type="button"
                onClick={deleteSelectedFolder}
                disabled={state.selection.kind !== "folder"}
                className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/60"
              >
                폴더 삭제
              </button>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                value={folderRenameName}
                onChange={(event) => setFolderRenameName(event.target.value)}
                placeholder="선택 폴더명 변경"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none ring-indigo-500 focus:ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={renameFocusedFolder}
                disabled={!focusFolderId || !folderRenameName.trim()}
                className="rounded-lg border border-indigo-300 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-700 dark:bg-slate-800 dark:text-indigo-300 dark:hover:bg-slate-700"
              >
                이름 저장
              </button>
            </div>
          </div>

          <div className="mt-2.5 max-h-[560px] space-y-0.5 overflow-y-auto pr-1">
            {rootFolders.map((folder) => renderFolderNode(folder, 0))}
          </div>
        </aside>

        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            {selectedEntry ? (
              <>
                <div className="grid gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">제목</label>
                    <input
                      value={selectedEntry.title ?? ""}
                      onChange={(event) => setField("title", event.target.value)}
                      placeholder="기록 제목을 입력하세요."
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-indigo-500 focus:ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">유형</label>
                      <select
                        value={(selectedEntry.type ?? "태스크") as WorkLogType}
                        onChange={(event) => setField("type", event.target.value as WorkLogType)}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-indigo-500 focus:ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        {WORK_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">완료일</label>
                      <input
                        type="date"
                        value={selectedEntry.date ?? todayIsoDate()}
                        onChange={(event) => setField("date", event.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-indigo-500 focus:ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">소요 기간</label>
                    <div className="mt-2 grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={selectedEntry.durationWeeks ?? 0}
                        onChange={(event) => setField("durationWeeks", normalizeDurationValue(event.target.value, 0))}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">주</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={selectedEntry.durationDays ?? 1}
                        onChange={(event) => setField("durationDays", normalizeDurationValue(event.target.value, 0))}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">일</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">자동 계산 기간</label>
                    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                      {selectedEntryPeriod
                        ? `${selectedEntryPeriod.startDate} ~ ${selectedEntryPeriod.endDate} (${selectedEntryPeriod.totalDays}일)`
                        : "-"}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                      기록 내용(달성실적)
                    </label>
                    <textarea
                      rows={7}
                      value={selectedEntry.result ?? ""}
                      onChange={(event) => setField("result", event.target.value)}
                      placeholder="달성실적을 입력하세요."
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm leading-6 outline-none ring-indigo-500 focus:ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">태그</label>
                    <input
                      value={selectedEntry.tags ?? ""}
                      onChange={(event) => setField("tags", event.target.value)}
                      placeholder="예: 협업, 자동화, 품질개선"
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-indigo-500 focus:ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={deleteSelectedEntry}
                    className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/60"
                  >
                    이 항목 삭제
                  </button>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <p className="font-semibold">폴더가 선택되었습니다.</p>
                <p className="mt-1">이 폴더에 기록을 추가하려면 아래 버튼을 누르세요.</p>
                <button
                  type="button"
                  onClick={() => addEntry(focusFolderId)}
                  className="mt-3 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
                >
                  이 폴더에 기록 추가
                </button>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 dark:border-indigo-900 dark:bg-indigo-950/25">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                    시즌 연도
                  </label>
                  <select
                    value={seasonYear}
                    onChange={(event) => setSeasonYear(Number(event.target.value))}
                    className="mt-1 w-32 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                    시즌
                  </label>
                  <select
                    value={season}
                    onChange={(event) => setSeason(event.target.value as WorkLogSeason)}
                    className="mt-1 w-36 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="all">연간 전체</option>
                    <option value="h1">상반기</option>
                    <option value="h2">하반기</option>
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={organizeFolderSeason}
                disabled={isFolderOrganizing || !focusFolderId}
                className="rounded-xl border border-indigo-300 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-700 dark:bg-slate-800 dark:text-indigo-300 dark:hover:bg-slate-700"
              >
                {isFolderOrganizing ? "폴더 리뷰 생성 중..." : `폴더 리뷰 (${filteredFolderEntries.length}건)`}
              </button>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                폴더 시즌 리뷰 결과
              </label>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                대상 폴더: <span className="font-semibold">{focusFolderName}</span> (하위 폴더 포함)
              </p>
              <textarea
                rows={10}
                readOnly
                value={state.folderOrganizedDraft ?? ""}
                placeholder="선택 폴더 전용 리뷰 초안이 생성됩니다."
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
              />
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ERP/평가 시스템 복붙 전에 사실 관계만 최종 확인하세요.
                </p>
                <button
                  type="button"
                  onClick={copyFolderDraft}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {folderCopied ? "복사 완료" : "폴더 리뷰 복사"}
                </button>
              </div>
              {folderOrganizeError && (
                <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-300">{folderOrganizeError}</p>
              )}
            </div>
          </div>
        </div>
      </div>
      ) : topTab === "track1-preview" ? (
        <div className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 dark:border-indigo-900 dark:bg-indigo-950/25">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                  시즌 연도
                </label>
                <select
                  value={seasonYear}
                  onChange={(event) => setSeasonYear(Number(event.target.value))}
                  className="mt-1 w-32 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                  시즌
                </label>
                <select
                  value={season}
                  onChange={(event) => setSeason(event.target.value as WorkLogSeason)}
                  className="mt-1 w-36 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="all">연간 전체</option>
                  <option value="h1">상반기</option>
                  <option value="h2">하반기</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={() => appendCandidatesToTrack1(resolvedTrack1Candidates.map((candidate) => candidate.id))}
              disabled={!resolvedTrack1Candidates.length}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Track 1에 전체 추가 ({resolvedTrack1Candidates.length}개)
            </button>
            <button
              type="button"
              onClick={refreshTrack1Preview}
              aria-label="미리보기 새로고침"
              title="미리보기 새로고침"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-300 bg-white text-indigo-700 transition hover:bg-indigo-50 dark:border-indigo-700 dark:bg-slate-800 dark:text-indigo-300 dark:hover:bg-slate-700"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <polyline points="21 3 21 9 15 9" />
              </svg>
              <span className="sr-only">미리보기 새로고침</span>
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            시즌 조건에 맞는 모든 폴더를 후보로 표시합니다. 폴더를 선택하면 우측 편집/상담 패널이 열립니다.
          </p>

          {candidateApplyMessage && (
            <p
              className={`mt-2 text-xs font-semibold ${
                isCandidateApplyError
                  ? "text-rose-700 dark:text-rose-300"
                  : "text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {candidateApplyMessage}
            </p>
          )}

          <div className="mt-4 grid gap-4 xl:grid-cols-[300px_1fr_280px]">
            <aside className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
              {resolvedTrack1Candidates.length ? (
                resolvedTrack1Candidates.map((candidate) => {
                  const isActive = selectedCandidateId === candidate.id;
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => selectCandidate(candidate.id)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        isActive
                          ? "border-indigo-400 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/40"
                          : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                      }`}
                    >
                      <p className="line-clamp-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                        {candidate.goalCategory || "목표구분 미정"}
                      </p>
                      <p className="mt-1 line-clamp-1 text-xs text-slate-600 dark:text-slate-300">
                        KPI명: {candidate.kpiName || "-"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {candidate.sourceEntryCount}건 · {candidate.sourcePeriod}
                      </p>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 p-4 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  후보가 없습니다.
                </div>
              )}
            </aside>

            {selectedCandidate ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                {/* ── 목표과업 (공유 필드) ── */}
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">목표구분</label>
                    <input
                      value={selectedCandidate.goalCategory}
                      onChange={(event) =>
                        setCandidateField(selectedCandidate.id, "goalCategory", event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">R&R</label>
                    <input
                      value={selectedCandidate.roleAndResponsibilities}
                      onChange={(event) =>
                        setCandidateField(selectedCandidate.id, "roleAndResponsibilities", event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
                <div className="mt-3 max-w-[200px]">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">목표과업 비중</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={5}
                      value={selectedCandidate.goalTaskWeight}
                      onChange={(event) =>
                        setCandidateField(
                          selectedCandidate.id,
                          "goalTaskWeight",
                          parsePercentInput(event.target.value)
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">%</span>
                  </div>
                </div>

                {/* ── 과업KPI 하위과업 카드 ── */}
                <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                      과업KPI (하위과업)
                      <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-500 dark:text-slate-400">
                        {selectedSubTasks.length}개
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => addSubTaskCard(selectedCandidate.id)}
                      className="rounded-md border border-indigo-300 px-2 py-1 text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-slate-700"
                    >
                      + 하위과업 추가
                    </button>
                  </div>

                  <div className="mt-3 space-y-2">
                    {selectedSubTasks.map((card, idx) => {
                      const isExpanded = expandedCardId === card.id;
                      const isLocked = card.locked;
                      return (
                        <div
                          key={card.id}
                          className={`rounded-lg border transition ${
                            isExpanded
                              ? "border-indigo-300 bg-indigo-50/40 dark:border-indigo-700 dark:bg-indigo-950/30"
                              : isLocked
                                ? "border-slate-200 bg-slate-100/50 dark:border-slate-700 dark:bg-slate-800/50"
                                : "border-indigo-100 bg-white dark:border-indigo-900/60 dark:bg-slate-800"
                          }`}
                        >
                          {/* ── 헤더 (항상 표시) ── */}
                          <button
                            type="button"
                            onClick={() => setExpandedCardId(isExpanded ? null : card.id)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left"
                          >
                            <span className="text-[11px] text-indigo-500 dark:text-indigo-400">
                              {isExpanded ? "\u25BC" : "\u25B6"}
                            </span>
                            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                              {idx + 1}/{selectedSubTasks.length}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs text-slate-800 dark:text-slate-200">
                              {card.kpiName || "KPI명 미입력"}
                            </span>
                            {isLocked && (
                              <span className="shrink-0 text-[11px] text-amber-600 dark:text-amber-400" title="잠김">
                                \uD83D\uDD12
                              </span>
                            )}
                          </button>

                          {/* ── 펼친 상태 (편집 영역) ── */}
                          {isExpanded && (
                            <div className={`border-t border-indigo-200 px-3 pb-3 pt-2 dark:border-indigo-800 ${isLocked ? "opacity-60" : ""}`}>
                              <div className="mb-2 flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSubTaskLock(selectedCandidate.id, card.id);
                                  }}
                                  className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition ${
                                    isLocked
                                      ? "text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                                      : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                                  }`}
                                  title={isLocked ? "잠금 해제" : "잠금 (AI 수정 차단)"}
                                >
                                  {isLocked ? "\uD83D\uDD12 잠금 해제" : "\uD83D\uDD13 잠금"}
                                </button>
                                {selectedSubTasks.length > 1 && !isLocked && (
                                  <button
                                    type="button"
                                    onClick={() => removeSubTaskCard(selectedCandidate.id, card.id)}
                                    className="rounded px-1.5 py-0.5 text-[11px] text-red-500 transition hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                                  >
                                    삭제
                                  </button>
                                )}
                              </div>
                              <div className="grid gap-2 md:grid-cols-2">
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">KPI명</label>
                                  <input
                                    value={card.kpiName}
                                    disabled={isLocked}
                                    onChange={(e) =>
                                      setSubTaskCardField(selectedCandidate.id, card.id, "kpiName", e.target.value)
                                    }
                                    className="mt-0.5 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm outline-none ring-indigo-500 focus:ring disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">하위과업 비중</label>
                                  <div className="mt-0.5 flex items-center gap-1.5">
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      step={5}
                                      value={card.subTaskWeight}
                                      disabled={isLocked}
                                      onChange={(e) =>
                                        setSubTaskCardField(
                                          selectedCandidate.id,
                                          card.id,
                                          "subTaskWeight",
                                          parsePercentInput(e.target.value)
                                        )
                                      }
                                      placeholder="0-100"
                                      className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm outline-none ring-indigo-500 focus:ring disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800"
                                    />
                                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">%</span>
                                  </div>
                                </div>
                              </div>
                              <div className="mt-2">
                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">KPI과제</label>
                                <textarea
                                  rows={2}
                                  value={card.kpiTask}
                                  disabled={isLocked}
                                  onChange={(e) =>
                                    setSubTaskCardField(selectedCandidate.id, card.id, "kpiTask", e.target.value)
                                  }
                                  className="mt-0.5 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm leading-5 outline-none ring-indigo-500 focus:ring disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800"
                                />
                              </div>
                              <div className="mt-2">
                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">달성계획</label>
                                <textarea
                                  rows={2}
                                  value={card.achievementPlan}
                                  disabled={isLocked}
                                  onChange={(e) =>
                                    setSubTaskCardField(selectedCandidate.id, card.id, "achievementPlan", e.target.value)
                                  }
                                  className="mt-0.5 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm leading-5 outline-none ring-indigo-500 focus:ring disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800"
                                />
                              </div>
                              <div className="mt-2">
                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">KPI산식(기준)</label>
                                <textarea
                                  rows={3}
                                  value={card.kpiFormula}
                                  disabled={isLocked}
                                  onChange={(e) =>
                                    setSubTaskCardField(selectedCandidate.id, card.id, "kpiFormula", e.target.value)
                                  }
                                  className="mt-0.5 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm leading-5 outline-none ring-indigo-500 focus:ring disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── 하단 정보 + 추가 버튼 ── */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    소스 {selectedCandidate.sourceEntryCount}건 · {selectedCandidate.sourcePeriod} ·{" "}
                    {selectedCandidate.sourceFolderLabel}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => appendCandidatesToTrack1([selectedCandidate.id])}
                      className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 dark:border-indigo-700 dark:bg-slate-700 dark:text-indigo-300 dark:hover:bg-slate-600"
                    >
                      Track 1에 추가 ({selectedSubTasks.length}개 카드)
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                선택한 범위에서 후보를 만들 기록이 없습니다.
              </div>
            )}

            <aside className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
              <p className="text-xs font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">진행상황</p>
              <div className="mt-2 space-y-1.5 text-xs">
                <p
                  className={
                    mergedCandidateProgress.baselineConfirmed
                      ? "font-semibold text-emerald-700 dark:text-emerald-300"
                      : "text-slate-600 dark:text-slate-300"
                  }
                >
                  1) 근거 기록 확보
                </p>
                <p
                  className={
                    mergedCandidateProgress.formulaConfirmed
                      ? "font-semibold text-emerald-700 dark:text-emerald-300"
                      : "text-slate-600 dark:text-slate-300"
                  }
                >
                  2) KPI 산식/기준 설정
                </p>
                <p
                  className={
                    mergedCandidateProgress.targetConfirmed
                      ? "font-semibold text-emerald-700 dark:text-emerald-300"
                      : "text-slate-600 dark:text-slate-300"
                  }
                >
                  3) 목표치 수치 확정
                </p>
                <p
                  className={
                    mergedCandidateProgress.readyToApply
                      ? "font-semibold text-emerald-700 dark:text-emerald-300"
                      : "text-slate-600 dark:text-slate-300"
                  }
                >
                  4) Track1 추가 가능
                </p>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                    후보 상담
                  </p>
                  <button
                    type="button"
                    onClick={startCandidateCoach}
                    disabled={!selectedCandidate || coachLoadingCandidateId === selectedCandidate.id}
                    className="rounded-md border border-indigo-300 px-2 py-1 text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-slate-700"
                  >
                    {selectedCandidate && coachLoadingCandidateId === selectedCandidate.id
                      ? "상담중..."
                      : selectedCandidateChat?.messages.some((message) => message.role === "assistant")
                        ? "질문 다시 받기"
                        : "상담 시작"}
                  </button>
                </div>
                <div className="mt-2 h-56 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900">
                  {selectedCandidateChat?.messages.length ? (
                    selectedCandidateChat.messages.map((message) => (
                      <div
                        key={message.id}
                        className={`mb-2 rounded-lg px-2 py-1.5 text-xs leading-5 ${
                          message.role === "assistant"
                            ? "bg-indigo-100 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-100"
                            : "bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                        }`}
                      >
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wide opacity-70">
                          {message.role === "assistant" ? "AI" : "Me"}
                        </p>
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {expandedCardId && selectedSubTasks.find((c) => c.id === expandedCardId)
                        ? `'${selectedSubTasks.find((c) => c.id === expandedCardId)!.kpiName || "카드"}' 기준으로 상담합니다.`
                        : "카드를 펼치면 해당 KPI 기준으로 상담합니다."}
                    </p>
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={candidateChatInput}
                    onChange={(event) => setCandidateChatInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void sendCandidateChat();
                      }
                    }}
                    placeholder="예: 주간연재 목표치를 몇 화로 두는 게 좋을까?"
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none ring-indigo-500 focus:ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => void sendCandidateChat()}
                    disabled={!selectedCandidate || coachLoadingCandidateId === selectedCandidate.id}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    전송
                  </button>
                </div>
                {candidateCoachError && (
                  <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-300">{candidateCoachError}</p>
                )}
              </div>
            </aside>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 dark:border-indigo-900 dark:bg-indigo-950/25">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                  시즌 연도
                </label>
                <select
                  value={seasonYear}
                  onChange={(event) => setSeasonYear(Number(event.target.value))}
                  className="mt-1 w-32 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                  시즌
                </label>
                <select
                  value={season}
                  onChange={(event) => setSeason(event.target.value as WorkLogSeason)}
                  className="mt-1 w-36 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="all">연간 전체</option>
                  <option value="h1">상반기</option>
                  <option value="h2">하반기</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={organizeSeason}
              disabled={isOrganizing}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isOrganizing ? "전체 리뷰 생성 중..." : `전체 리뷰 (${filteredEntries.length}건)`}
            </button>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">전체 시즌 리뷰 결과</label>
            <textarea
              rows={12}
              readOnly
              value={state.organizedDraft ?? ""}
              placeholder="상시 기록 전체를 바탕으로 업적/역량 평가 작성용 초안이 생성됩니다."
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
            />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                최종 제출 전 내용/수치 사실 관계를 점검하세요.
              </p>
              <button
                type="button"
                onClick={copyDraft}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {copied ? "복사 완료" : "복사"}
              </button>
            </div>
            {organizeError && (
              <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-300">{organizeError}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

