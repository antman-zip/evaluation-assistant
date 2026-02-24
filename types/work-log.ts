export type WorkLogType = "이벤트" | "프로젝트" | "태스크" | "기타";

export type WorkLogEntry = {
  id: string;
  folderId: string | null;
  sortOrder: number;
  title: string;
  type: WorkLogType;
  date: string; // 완료일, YYYY-MM-DD
  durationWeeks: number; // 소요 주
  durationDays: number; // 소요 일
  context: string;
  result: string;
  metrics: string;
  tags: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkLogFolder = {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkLogSeason = "all" | "h1" | "h2";

export type WorkLogSelection = {
  kind: "entry" | "folder";
  id: string | null;
};

export type WorkLogState = {
  folders: WorkLogFolder[];
  entries: WorkLogEntry[];
  selection: WorkLogSelection;
  collapsedFolderIds: string[];
  organizedDraft: string;
  folderOrganizedDraft: string;
};
