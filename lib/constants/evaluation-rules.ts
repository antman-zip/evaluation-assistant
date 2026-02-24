export const KPI_RULES = {
  scoreRange: { min: 0, max: 100 },
  summaryMaxChars: 2000,
  gradeScale: ["탁월", "우수", "달성", "노력", "미흡"]
} as const;

export const COMPETENCY_RULES = {
  coreCompetencies: ["도전 시도", "선의 경쟁", "성장 정신", "규정 준수"],
  gradeScale: ["탁월", "우수", "보통", "노력"]
} as const;
