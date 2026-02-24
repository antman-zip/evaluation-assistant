import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { PerformanceGrade } from "@/types/evaluation";

export const runtime = "nodejs";
export const maxDuration = 60;

type RefineItemPayload = {
  goalCategory: string;
  roleAndResponsibilities: string;
  goalTaskWeight: number | "";
  kpiName: string;
  kpiTask: string;
  achievementPlan: string;
  kpiFormula: string;
  subTaskWeight: number | "";
  grade: PerformanceGrade;
  score: number;
  achievementResult: string;
};

type RefineRequestBody = {
  item?: RefineItemPayload;
};

type ProviderName = "gemini" | "openai";
const TARGET_MIN_LENGTH = 150;
const TARGET_MAX_LENGTH = 200;

function getGradeToneGuide(grade: PerformanceGrade) {
  const guideMap: Record<PerformanceGrade, string> = {
    탁월:
      "탁월 등급: 성과의 파급효과, 난이도 높은 과제 완수, 조직 기여를 자신감 있게 강조하되 과장하지 않는다.",
    우수:
      "우수 등급: 목표를 안정적으로 상회 달성한 점과 실행력, 협업 기여를 분명히 강조한다.",
    달성:
      "달성 등급: 목표를 충실히 달성한 사실 중심으로 작성하고, 과도한 수사는 피한다.",
    노력:
      "노력 등급: 성과와 한계를 함께 서술하고, 개선 시도와 향후 보완 계획을 균형 있게 담는다.",
    미흡:
      "미흡 등급: 미달 원인, 반성 포인트, 재발 방지 및 개선 계획을 명확하고 책임감 있게 작성한다."
  };

  return guideMap[grade];
}

function buildRefinePrompt(item: RefineItemPayload) {
  return [
    "당신은 사내 성과평가 문장 교정 전문가입니다.",
    "아래 입력을 바탕으로 ERP 붙여넣기용 '달성실적' 문장을 한국어로 다듬어 주세요.",
    "규칙:",
    "1) 사실 범위를 벗어난 과장 금지",
    "2) 한 단락으로 작성",
    `3) ${TARGET_MIN_LENGTH}~${TARGET_MAX_LENGTH}자 내외`,
    "4) 한국어만 사용 (영문 체크리스트/평가 코멘트 금지)",
    "5) 출력은 본문만, 제목/머리말/불릿/번호/메타설명 금지",
    `6) 등급별 문체 가이드: ${getGradeToneGuide(item.grade)}`,
    "",
    `목표구분: ${item.goalCategory || "-"}`,
    `R&R: ${item.roleAndResponsibilities || "-"}`,
    `목표과업 비중: ${item.goalTaskWeight === "" ? "-" : `${item.goalTaskWeight}%`}`,
    `KPI명: ${item.kpiName || "-"}`,
    `KPI과제: ${item.kpiTask || "-"}`,
    `달성계획: ${item.achievementPlan || "-"}`,
    `KPI산식: ${item.kpiFormula || "-"}`,
    `하위과업 비중: ${item.subTaskWeight === "" ? "-" : `${item.subTaskWeight}%`}`,
    `자가 평가: ${item.grade} (${item.score}점)`,
    "",
    "원문 달성실적:",
    item.achievementResult || "(원문 없음)"
  ].join("\n");
}

function buildStrictRetryPrompt(item: RefineItemPayload, draft: string) {
  return [
    "아래 초안을 ERP용 달성실적으로 다시 작성하세요.",
    "절대 규칙:",
    `1) 정확히 ${TARGET_MIN_LENGTH}~${TARGET_MAX_LENGTH}자`,
    "2) 한국어 본문 한 단락만 출력",
    "3) 불릿, 번호, 체크리스트, 'Good', 'Final', 'Review' 같은 메타 문구 금지",
    "4) 문장 중간 끊김 없이 완결형 종결어미로 마무리",
    `5) 등급별 문체 가이드: ${getGradeToneGuide(item.grade)}`,
    "",
    "초안:",
    draft
  ].join("\n");
}

async function refineWithGemini(prompt: string) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return null;
  const geminiApiKey = apiKey;

  const configuredModel = (process.env.GEMINI_MODEL ?? "gemini-2.0-flash")
    .replace(/^models\//, "")
    .trim();
  const modelCandidates = Array.from(
    new Set([configuredModel, "gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"])
  );
  const apiVersions = ["v1beta", "v1"] as const;

  async function generateWithFallback(currentPrompt: string) {
    let last404Error = "";

    for (const model of modelCandidates) {
      for (const version of apiVersions) {
        const endpoint = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${encodeURIComponent(
          geminiApiKey
        )}`;

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: currentPrompt }]
              }
            ],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 1200
            }
          })
        });

        if (!response.ok) {
          const errorBody = await response.text();

          if (response.status === 404) {
            last404Error = `${version}/${model}: ${errorBody}`;
            continue;
          }

          throw new Error(`Gemini API 요청 실패 (${version}/${model}): ${response.status} ${errorBody}`);
        }

        const data = (await response.json()) as {
          candidates?: Array<{
            finishReason?: string;
            content?: {
              parts?: Array<{ text?: string }>;
            };
          }>;
        };

        const candidate = data.candidates?.[0];
        const text =
          candidate?.content?.parts
            ?.map((part) => part.text ?? "")
            .join("")
            .trim() ?? "";

        if (text) {
          return {
            text,
            finishReason: candidate?.finishReason ?? ""
          };
        }
      }
    }

    throw new Error(
      `Gemini 모델을 찾지 못했습니다. GEMINI_MODEL을 확인하세요. 마지막 404: ${last404Error || "none"}`
    );
  }

  const first = await generateWithFallback(prompt);
  let combined = first.text;
  let finishReason = first.finishReason;

  // 응답이 토큰 제한으로 끊기거나 문장이 미완성인 경우 자동으로 이어받아 결합한다.
  for (let i = 0; i < 2; i += 1) {
    if (finishReason !== "MAX_TOKENS" && !isLikelyIncomplete(combined)) {
      break;
    }

    const continuationPrompt = [
      "아래 문장에 자연스럽게 이어지는 다음 문장만 작성하세요.",
      "규칙:",
      "1) 기존 문장을 반복하지 말 것",
      "2) 새 문장만 출력할 것",
      "3) 마지막은 완결된 문장으로 끝낼 것",
      "",
      "기존 문장:",
      combined
    ].join("\n");

    const next = await generateWithFallback(continuationPrompt);
    if (!next.text) break;

    const addition = next.text.trim();
    if (!addition) break;

    combined = `${combined} ${addition}`.replace(/\s+/g, " ").trim();
    finishReason = next.finishReason;
  }

  return combined || null;
}

async function refineWithOpenAI(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const openai = new OpenAI({ apiKey });
  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    input: prompt
  });

  return response.output_text?.trim() || null;
}

function cleanupText(text: string) {
  return text.trim().replace(/^["'`]+|["'`]+$/g, "").trim();
}

function isLikelyIncomplete(text: string) {
  const normalized = text.trim();
  if (!normalized) return true;
  if (normalized.length < 110) return true;
  if (/[,\-/:;("'`]\s*$/.test(normalized)) return true;
  if (/(및|또는|그리고)\s*$/.test(normalized)) return true;
  if (!/[.?!]$/.test(normalized) && !/(다|니다|합니다|였습니다)$/.test(normalized)) return true;
  return false;
}

function isMetaLikeOutput(text: string) {
  const normalized = text.trim();
  if (!normalized) return true;
  if (/(\*{1,2}|^\d+\.)/m.test(normalized)) return true;
  if (/(Final Polish|Enhancement|Good\.|No bullets|guide followed|characters)/i.test(normalized)) {
    return true;
  }
  return false;
}

function isLengthOutOfRange(text: string) {
  const len = text.trim().length;
  return len < TARGET_MIN_LENGTH || len > TARGET_MAX_LENGTH;
}

async function runRefine(prompt: string, preferred?: ProviderName) {
  const providerOrder: ProviderName[] = preferred
    ? [preferred, preferred === "gemini" ? "openai" : "gemini"]
    : ["gemini", "openai"];

  let lastError: Error | null = null;

  for (const provider of providerOrder) {
    try {
      const text =
        provider === "gemini" ? await refineWithGemini(prompt) : await refineWithOpenAI(prompt);
      if (!text) continue;
      return { provider, text: cleanupText(text) };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("unknown provider error");
    }
  }

  if (lastError) throw lastError;
  return null;
}

export async function POST(req: Request) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error:
          "GOOGLE_GENERATIVE_AI_API_KEY 또는 OPENAI_API_KEY 중 하나가 필요합니다. .env.local을 확인하세요."
      },
      { status: 500 }
    );
  }

  let body: RefineRequestBody;
  try {
    body = (await req.json()) as RefineRequestBody;
  } catch {
    return NextResponse.json({ error: "잘못된 JSON 요청입니다." }, { status: 400 });
  }

  if (!body.item) {
    return NextResponse.json({ error: "item payload가 필요합니다." }, { status: 400 });
  }

  const prompt = buildRefinePrompt(body.item);

  try {
    const firstResult = await runRefine(prompt);

    if (!firstResult?.text) {
      return NextResponse.json(
        { error: "AI 응답이 비어 있습니다. 모델/키 설정을 확인 후 다시 시도해 주세요." },
        { status: 502 }
      );
    }

    let refinedText = firstResult.text;

    if (isLikelyIncomplete(refinedText) || isMetaLikeOutput(refinedText) || isLengthOutOfRange(refinedText)) {
      const retryPrompt = buildStrictRetryPrompt(body.item, refinedText);

      const secondResult = await runRefine(retryPrompt, firstResult.provider);
      if (secondResult?.text) {
        refinedText = secondResult.text;
      }
    }

    if (!refinedText) {
      return NextResponse.json(
        { error: "AI 응답이 비어 있습니다. 모델/키 설정을 확인 후 다시 시도해 주세요." },
        { status: 502 }
      );
    }

    return NextResponse.json({ refinedText: refinedText.slice(0, 2000) });
  } catch (error) {
    console.error("Failed to refine performance text", error);
    return NextResponse.json(
      { error: "AI 문장 다듬기 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
