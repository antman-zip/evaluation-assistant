type BuildPromptArgs = {
  track: "performance" | "competency";
  message: string;
  rules: {
    kpi: unknown;
    competency: unknown;
  };
  meta?: Record<string, string | number | undefined>;
};

export function buildEvaluationPrompt({
  track,
  message,
  rules,
  meta
}: BuildPromptArgs): string {
  return [
    "당신은 사내 성과/역량평가 작성 코치입니다.",
    "규칙을 위반하지 말고, 입력 사실을 과장하지 말며, ERP 복사-붙여넣기 가능한 문장으로 작성하세요.",
    `현재 트랙: ${track}`,
    `메타데이터: ${JSON.stringify(meta ?? {}, null, 2)}`,
    `KPI 규칙(JSON): ${JSON.stringify(rules.kpi, null, 2)}`,
    `역량 규칙(JSON): ${JSON.stringify(rules.competency, null, 2)}`,
    "사용자 입력:",
    message
  ].join("\n\n");
}
