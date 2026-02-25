import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { Track1Form } from "@/types/evaluation";
import type { WorkLogEntry } from "@/types/work-log";

export const runtime = "nodejs";
export const maxDuration = 60;

type ProviderName = "gemini" | "openai";
type CoachMode = "kickoff" | "chat";

type ChatMessagePayload = {
  role: "user" | "assistant";
  content: string;
};

type CandidatePayload = Track1Form & {
  sourceEntryCount?: number;
  sourcePeriod?: string;
  sourceFolderLabel?: string;
  sourceType?: string;
};

type CandidateCoachRequestBody = {
  mode?: CoachMode;
  userMessage?: string;
  candidate?: CandidatePayload;
  entries?: WorkLogEntry[];
  messages?: ChatMessagePayload[];
  currentCardCount?: number;
  geminiApiKey?: string;
  geminiModel?: string;
};

type CandidateProgressPayload = {
  baselineConfirmed: boolean;
  formulaConfirmed: boolean;
  targetConfirmed: boolean;
  readyToApply: boolean;
};

type SuggestedCard = {
  kpiName: string;
  kpiTask: string;
  achievementPlan: string;
  kpiFormula: string;
  subTaskWeight: number | "";
};

type CandidateCoachResult = {
  reply: string;
  progress: CandidateProgressPayload;
  suggestedUpdates?: Partial<Track1Form>;
  suggestedCards?: SuggestedCard[];
};

const PERFORMANCE_GRADES = new Set(["탁월", "우수", "달성", "노력", "미흡"]);

function defaultProgress(): CandidateProgressPayload {
  return {
    baselineConfirmed: false,
    formulaConfirmed: false,
    targetConfirmed: false,
    readyToApply: false
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function sanitizeSuggestedUpdates(value: unknown): Partial<Track1Form> | undefined {
  if (!isRecord(value)) return undefined;
  const output: Partial<Track1Form> = {};

  if (typeof value.goalCategory === "string") output.goalCategory = value.goalCategory;
  if (typeof value.roleAndResponsibilities === "string")
    output.roleAndResponsibilities = value.roleAndResponsibilities;
  if (typeof value.kpiName === "string") output.kpiName = value.kpiName;
  if (typeof value.kpiTask === "string") output.kpiTask = value.kpiTask;
  if (typeof value.achievementPlan === "string") output.achievementPlan = stripDateLikeText(value.achievementPlan);
  if (typeof value.kpiFormula === "string") output.kpiFormula = value.kpiFormula;
  if (typeof value.achievementResult === "string") output.achievementResult = value.achievementResult;

  if (typeof value.goalTaskWeight === "number" && Number.isFinite(value.goalTaskWeight)) {
    output.goalTaskWeight = Math.max(0, Math.min(100, Math.round(value.goalTaskWeight)));
  }
  if (typeof value.subTaskWeight === "number" && Number.isFinite(value.subTaskWeight)) {
    output.subTaskWeight = Math.max(0, Math.min(100, Math.round(value.subTaskWeight)));
  }

  if (typeof value.grade === "string" && PERFORMANCE_GRADES.has(value.grade)) {
    output.grade = value.grade as Track1Form["grade"];
  }
  if (typeof value.score === "number" && Number.isFinite(value.score)) {
    output.score = Math.max(0, Math.min(100, Math.round(value.score)));
  }

  return Object.keys(output).length ? output : undefined;
}

function stripDateLikeText(value: string) {
  return value
    .replace(/\b\d{4}[-./]\d{1,2}[-./]\d{1,2}\b/g, "")
    .replace(/\b\d{1,2}월\s*\d{1,2}일\b/g, "")
    .replace(/\b\d{1,2}\/\d{1,2}\b/g, "")
    .replace(/\b\d{4}년\s*\d{1,2}월\b/g, "")
    .replace(/\b\d{1,2}주\b/g, "")
    .replace(/\b\d{1,2}일\b/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function sanitizeSuggestedCards(value: unknown): SuggestedCard[] | undefined {
  if (!Array.isArray(value) || !value.length) return undefined;
  const cards: SuggestedCard[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const kpiName = typeof item.kpiName === "string" ? item.kpiName.trim() : "";
    const kpiTask = typeof item.kpiTask === "string" ? item.kpiTask.trim() : "";
    const achievementPlan = typeof item.achievementPlan === "string" ? stripDateLikeText(item.achievementPlan) : "";
    const kpiFormula = typeof item.kpiFormula === "string" ? item.kpiFormula.trim() : "";
    const subTaskWeight =
      typeof item.subTaskWeight === "number" && Number.isFinite(item.subTaskWeight)
        ? Math.max(0, Math.min(100, Math.round(item.subTaskWeight)))
        : "";
    if (!kpiName) continue;
    cards.push({ kpiName, kpiTask, achievementPlan, kpiFormula, subTaskWeight });
  }
  return cards.length ? cards : undefined;
}

function sanitizeProgress(value: unknown): CandidateProgressPayload {
  if (!isRecord(value)) return defaultProgress();
  return {
    baselineConfirmed: value.baselineConfirmed === true,
    formulaConfirmed: value.formulaConfirmed === true,
    targetConfirmed: value.targetConfirmed === true,
    readyToApply: value.readyToApply === true
  };
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function stripCodeFence(text: string) {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function unescapeJsonString(value: string) {
  return value
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\")
    .trim();
}

function extractReplyFromJsonLike(text: string) {
  const strict = text.match(/"reply"\s*:\s*"([\s\S]*?)"\s*(?:,|\})/);
  if (strict?.[1]) return unescapeJsonString(strict[1]);

  const loose = text.match(/"reply"\s*:\s*"([\s\S]*)$/);
  if (loose?.[1]) return unescapeJsonString(loose[1].replace(/"\s*$/, ""));

  return "";
}

function isLikelyIncompleteReply(text: string) {
  const normalized = text.trim();
  if (!normalized) return true;
  if (normalized.length < 24) return true;
  if (/[,\-/:;("'`*]\s*$/.test(normalized)) return true;
  const boldMarkerCount = (normalized.match(/\*\*/g) ?? []).length;
  if (boldMarkerCount % 2 === 1) return true;
  if (!/[.?!]$/.test(normalized) && !/(다|요|니다|합니다|됩니다|였습니다)$/.test(normalized)) {
    return true;
  }
  return false;
}

function parseCoachResult(raw: string): CandidateCoachResult {
  const trimmed = stripCodeFence(raw);
  const jsonLike = extractJsonObject(trimmed);
  if (jsonLike) {
    try {
      const parsed = JSON.parse(jsonLike) as Record<string, unknown>;
      const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
      const progress = sanitizeProgress(parsed.progress);
      const suggestedUpdates = sanitizeSuggestedUpdates(parsed.suggestedUpdates);
      const suggestedCards = sanitizeSuggestedCards(parsed.suggestedCards);
      if (reply) {
        return {
          reply,
          progress,
          suggestedUpdates,
          suggestedCards
        };
      }
    } catch {
      // fallback below
    }
  }

  const extractedReply = extractReplyFromJsonLike(trimmed);

  return {
    reply: extractedReply || trimmed || "기준 수립을 위해 현재 산식/목표치 초안을 먼저 알려 주세요.",
    progress: defaultProgress()
  };
}

function buildCoachRetryPrompt(mode: CoachMode, userMessage: string, candidate: CandidatePayload) {
  return [
    "아래 정보로 KPI 코칭 답변을 다시 작성하세요.",
    "직전 답변이 중간에 끊겼으므로 반드시 완결형 문장으로 마무리해야 합니다.",
    "달성계획은 반드시 3~4개의 번호형 마일스톤(1., 2., 3.)으로 작성하세요.",
    "달성계획에는 날짜/기간 표기(YYYY-MM-DD, n월 n일, n주, n일)를 넣지 마세요.",
    "KPI산식은 반드시 탁월/우수/달성/노력/미흡의 5단계 기준값이 모두 포함되게 작성하세요.",
    "출력은 반드시 JSON 하나:",
    "{",
    '  "reply": "한국어 3~5문장, 마크다운/불릿 없이 완결형",',
    '  "progress": {',
    '    "baselineConfirmed": boolean,',
    '    "formulaConfirmed": boolean,',
    '    "targetConfirmed": boolean,',
    '    "readyToApply": boolean',
    "  },",
    '  "suggestedUpdates": {',
    '    "goalCategory": "string",',
    '    "kpiName": "string",',
    '    "roleAndResponsibilities": "string",',
    '    "kpiTask": "string",',
    '    "achievementPlan": "string",',
    '    "kpiFormula": "string",',
    '    "achievementResult": "string"',
    "  }",
    "}",
    "",
    `모드: ${mode}`,
    `사용자 최근 입력: ${userMessage || "-"}`,
    `목표구분: ${candidate.goalCategory || "-"}`,
    `KPI명: ${candidate.kpiName || "-"}`,
    `KPI과제: ${candidate.kpiTask || "-"}`,
    `달성계획: ${candidate.achievementPlan || "-"}`,
    `KPI산식: ${candidate.kpiFormula || "-"}`,
    `달성실적: ${candidate.achievementResult || "-"}`
  ].join("\n");
}

function summarizeEntries(entries: WorkLogEntry[]) {
  return entries
    .slice(0, 15)
    .map((entry, index) =>
      [
        `[기록 ${index + 1}]`,
        `- 완료일: ${entry.date || "-"}`,
        `- 유형: ${entry.type || "-"}`,
        `- 제목: ${entry.title || "-"}`,
        `- 맥락: ${entry.context || "-"}`,
        `- 결과: ${entry.result || "-"}`,
        `- 지표: ${entry.metrics || "-"}`,
        `- 태그: ${entry.tags || "-"}`
      ].join("\n")
    )
    .join("\n\n");
}

function buildCoachPrompt(
  mode: CoachMode,
  userMessage: string,
  candidate: CandidatePayload,
  entries: WorkLogEntry[],
  messages: ChatMessagePayload[],
  currentCardCount: number
) {
  const conversation = messages
    .slice(-10)
    .map((message, index) => `${index + 1}. ${message.role === "assistant" ? "AI" : "USER"}: ${message.content}`)
    .join("\n");

  return [
    "당신은 사내 평가작성 KPI 코치입니다.",
    "목표: 사용자의 실적을 과장 없이 잘 드러내면서, 실무적으로 유리한 KPI 기준(달성 가능 + 도전성)을 함께 설계한다.",
    "중요 원칙:",
    "1) 사실 기반만 사용, 허위/과장 금지",
    "2) 모호하면 먼저 질문하고, 질문은 1~2개만 핵심적으로",
    "3) KPI 산식/목표치 확정이 우선",
    "4) 사용자 편의: 바로 Track1에 반영 가능한 수정안을 함께 제시",
    "5) 달성계획은 반드시 3~4개의 마일스톤 번호형 목록으로 작성 (1., 2., 3.)",
    "6) KPI산식은 반드시 탁월/우수/달성/노력/미흡 5단계 기준값이 모두 포함되어야 함",
    "7) 달성계획에는 날짜/기간 표기(YYYY-MM-DD, n월 n일, n주, n일)를 넣지 말 것",
    "8) 사용자가 하위과업 분리/나누기/구분을 요청하면 반드시 suggestedCards 배열에 2~3개의 완전한 카드를 포함하여 반환해야 한다. reply에 분리안을 텍스트로 설명하는 것만으로는 부족하다. 반드시 suggestedCards JSON 배열에 각 카드의 kpiName, kpiTask, achievementPlan, kpiFormula, subTaskWeight를 모두 채워서 반환한다. subTaskWeight 합계는 100이 되도록 한다. suggestedCards를 반환하면 UI에서 자동으로 카드가 생성된다.",
    "",
    `모드: ${mode}`,
    `사용자 최근 입력: ${userMessage || "-"}`,
    "",
    "[현재 후보 카드]",
    `- 목표구분: ${candidate.goalCategory || "-"}`,
    `- R&R: ${candidate.roleAndResponsibilities || "-"}`,
    `- 목표과업 비중: ${candidate.goalTaskWeight === "" ? "-" : `${candidate.goalTaskWeight}%`}`,
    `- KPI명: ${candidate.kpiName || "-"}`,
    `- KPI과제: ${candidate.kpiTask || "-"}`,
    `- 달성계획: ${candidate.achievementPlan || "-"}`,
    `- KPI산식: ${candidate.kpiFormula || "-"}`,
    `- 하위과업 비중: ${candidate.subTaskWeight === "" ? "-" : `${candidate.subTaskWeight}%`}`,
    `- 등급/점수: ${candidate.grade} ${candidate.score}점`,
    `- 달성실적: ${candidate.achievementResult || "-"}`,
    `- 소스: ${candidate.sourceEntryCount || 0}건 / ${candidate.sourcePeriod || "-"} / ${candidate.sourceFolderLabel || "-"}`,
    `- 현재 하위과업 카드 수: ${currentCardCount}개`,
    "",
    "[관련 기록]",
    summarizeEntries(entries),
    "",
    "[대화 히스토리]",
    conversation || "-",
    "",
    "출력은 반드시 JSON 하나만 반환:",
    "{",
    '  "reply": "사용자에게 보일 상담 답변. 4~8문장, 중간에 끊기지 않게 완결형으로 작성. 모드 kick-off면 먼저 핵심 질문 1~2개를 제시",',
    '  "progress": {',
    '    "baselineConfirmed": boolean,',
    '    "formulaConfirmed": boolean,',
    '    "targetConfirmed": boolean,',
    '    "readyToApply": boolean',
    "  },",
    '  "suggestedUpdates": {',
    '    "goalCategory": "string",',
    '    "roleAndResponsibilities": "string optional",',
    '    "kpiName": "string optional",',
    '    "goalTaskWeight": 0,',
    '    "kpiTask": "string optional",',
    '    "achievementPlan": "string optional",',
    '    "kpiFormula": "string optional",',
    '    "achievementResult": "string optional"',
    "  },",
    '  "suggestedCards": [',
    "    {",
    '      "kpiName": "string",',
    '      "kpiTask": "string",',
    '      "achievementPlan": "string",',
    '      "kpiFormula": "string",',
    '      "subTaskWeight": 50',
    "    }",
    "  ]",
    "}",
    "규칙: JSON 외 텍스트 금지, 코드블록 금지, reply 키 이름 노출 금지.",
    "추가 규칙: suggestedUpdates는 goalCategory, kpiName, roleAndResponsibilities, kpiTask, achievementPlan, kpiFormula, achievementResult를 반드시 채운다.",
    "achievementPlan은 줄바꿈 포함 번호형 3~4개 마일스톤으로 채운다.",
    "achievementPlan에는 날짜/기간 수치를 쓰지 않는다.",
    "kpiFormula는 산식 본문 + 탁월/우수/달성/노력/미흡 기준값 5줄을 함께 채운다.",
    "중요: 사용자가 '나눠', '분리', '하위과업', '구분' 등 분리를 요청하면 suggestedCards 배열에 2~3개 카드를 반드시 포함한다. reply에서 분리를 설명만 하고 suggestedCards를 비우면 안 된다. 분리 요청이 없으면 suggestedCards는 빈 배열로 둔다."
  ].join("\n");
}

async function coachWithGemini(prompt: string, overrideApiKey?: string, overrideModel?: string) {
  const apiKey = overrideApiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return null;

  const configuredModel = (overrideModel || process.env.GEMINI_MODEL || "gemini-2.0-flash")
    .replace(/^models\//, "")
    .trim();
  const modelCandidates = Array.from(
    new Set([configuredModel, "gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"])
  );
  const apiVersions = ["v1beta", "v1"] as const;

  let last404Error = "";

  for (const model of modelCandidates) {
    for (const version of apiVersions) {
      const endpoint = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 3072,
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        const err = await response.text();
        if (response.status === 404) {
          last404Error = `${version}/${model}: ${err}`;
          continue;
        }
        throw new Error(`Gemini API 요청 실패 (${version}/${model}): ${response.status} ${err}`);
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };

      const text =
        data.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? "")
          .join("")
          .trim() ?? "";
      if (text) return text;
    }
  }

  throw new Error(
    `Gemini 모델을 찾지 못했습니다. GEMINI_MODEL을 확인하세요. 마지막 404: ${last404Error || "none"}`
  );
}

async function coachWithOpenAI(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const openai = new OpenAI({ apiKey });
  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    input: prompt
  });

  return response.output_text?.trim() || null;
}

async function runCoach(prompt: string, preferred?: ProviderName, overrideApiKey?: string, overrideModel?: string) {
  const order: ProviderName[] = preferred
    ? [preferred, preferred === "gemini" ? "openai" : "gemini"]
    : ["gemini", "openai"];

  let lastError: Error | null = null;
  for (const provider of order) {
    try {
      const text = provider === "gemini" ? await coachWithGemini(prompt, overrideApiKey, overrideModel) : await coachWithOpenAI(prompt);
      if (!text) continue;
      return text;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("coach failed");
    }
  }

  if (lastError) throw lastError;
  return null;
}

export async function POST(req: Request) {
  let body: CandidateCoachRequestBody;
  try {
    body = (await req.json()) as CandidateCoachRequestBody;
  } catch {
    return NextResponse.json({ error: "잘못된 JSON 요청입니다." }, { status: 400 });
  }

  const clientApiKey = body.geminiApiKey?.trim() || undefined;
  const clientModel = body.geminiModel?.trim() || undefined;

  if (!clientApiKey && !process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "GOOGLE_GENERATIVE_AI_API_KEY 또는 OPENAI_API_KEY가 필요합니다. 설정에서 API Key를 입력하거나 .env.local을 확인하세요." },
      { status: 500 }
    );
  }

  const mode: CoachMode = body.mode === "chat" ? "chat" : "kickoff";
  const userMessage = (body.userMessage ?? "").trim();
  const candidate = body.candidate;
  const entries = body.entries ?? [];
  const messages = body.messages ?? [];
  const currentCardCount = typeof body.currentCardCount === "number" ? body.currentCardCount : 1;

  if (!candidate) {
    return NextResponse.json({ error: "candidate payload가 필요합니다." }, { status: 400 });
  }
  if (mode === "chat" && !userMessage) {
    return NextResponse.json({ error: "chat 모드에서는 userMessage가 필요합니다." }, { status: 400 });
  }

  const prompt = buildCoachPrompt(mode, userMessage, candidate, entries, messages, currentCardCount);

  try {
    const raw = await runCoach(prompt, undefined, clientApiKey, clientModel);
    if (!raw) {
      return NextResponse.json({ error: "AI 응답이 비어 있습니다." }, { status: 502 });
    }

    let result = parseCoachResult(raw);

    if (isLikelyIncompleteReply(result.reply)) {
      const retryPrompt = buildCoachRetryPrompt(mode, userMessage, candidate);
      const retryRaw = await runCoach(retryPrompt, undefined, clientApiKey, clientModel);
      if (retryRaw) {
        const retried = parseCoachResult(retryRaw);
        if (retried.reply && !isLikelyIncompleteReply(retried.reply)) {
          result = retried;
        }
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to coach candidate", error);
    return NextResponse.json({ error: "후보 상담 중 오류가 발생했습니다." }, { status: 500 });
  }
}
