export type PerformanceGrade = "탁월" | "우수" | "달성" | "노력" | "미흡";
export type CompetencyGrade = "탁월" | "우수" | "보통" | "노력";

export type Track1Form = {
  goalCategory: string;
  roleAndResponsibilities: string;
  goalTaskWeight: number | "";
  kpiName: string;
  kpiTask: string;
  achievementPlan: string;
  kpiFormula: string;
  subTaskWeight: number | "";
  grade: PerformanceGrade;
  achievementResult: string;
  score: number;
};

export const TRACK1_INITIAL_VALUE: Track1Form = {
  goalCategory: "",
  roleAndResponsibilities: "",
  goalTaskWeight: "",
  kpiName: "",
  kpiTask: "",
  achievementPlan: "",
  kpiFormula: "",
  subTaskWeight: "",
  grade: "달성",
  achievementResult: "",
  score: 70
};

export const PERFORMANCE_GRADE_SCORES: Record<PerformanceGrade, number> = {
  탁월: 100,
  우수: 90,
  달성: 70,
  노력: 50,
  미흡: 40
};
