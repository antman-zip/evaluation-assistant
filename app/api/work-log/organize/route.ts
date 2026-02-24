import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { WorkLogEntry, WorkLogSeason } from "@/types/work-log";

export const runtime = "nodejs";
export const maxDuration = 60;

type ProviderName = "gemini" | "openai";

type OrganizeRequestBody = {
  year?: number;
  season?: WorkLogSeason;
  entries?: WorkLogEntry[];
};

function seasonLabel(season: WorkLogSeason | undefined) {
  if (season === "h1") return "상반기";
  if (season === "h2") return "하반기";
  return "연간";
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

function buildPeriodLabel(entry: WorkLogEntry) {
  const end = parseYmdToUtcDate(entry.date);
  if (!end) return "-";
  const weeks = normalizeDurationValue((entry as WorkLogEntry & { durationWeeks?: number }).durationWeeks, 0);
  const days = normalizeDurationValue((entry as WorkLogEntry & { durationDays?: number }).durationDays, 1);
  const totalDays = Math.max(1, weeks * 7 + days);
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (totalDays - 1));
  return `${formatUtcYmd(start)} ~ ${formatUtcYmd(end)} (${totalDays}일)`;
}

function buildOrganizePrompt(year: number, season: WorkLogSeason, entries: WorkLogEntry[]) {
  const serializedEntries = entries
    .map((entry, index) =>
      [
        `[기록 ${index + 1}]`,
        `- 폴더ID: ${entry.folderId || "-"}`,
        `- 완료일: ${entry.date}`,
        `- 기간: ${buildPeriodLabel(entry)}`,
        `- 유형: ${entry.type}`,
        `- 제목: ${entry.title || "-"}`,
        `- 맥락: ${entry.context || "-"}`,
        `- 결과: ${entry.result || "-"}`,
        `- 지표: ${entry.metrics || "-"}`,
        `- 태그: ${entry.tags || "-"}`
      ].join("\n")
    )
    .join("\n\n");

  return [
    "당신은 인사평가 시즌 정리 코치입니다.",
    "아래 상시 업무 기록을 바탕으로 시즌 평가 작성을 위한 초안을 작성하세요.",
    "규칙:",
    "1) 입력 기록에 없는 사실을 추가하지 말 것",
    "2) 한국어만 사용",
    "3) 지나친 수사 없이 ERP 복붙 가능한 문체",
    "4) 반드시 아래 출력 형식을 그대로 유지",
    "",
    "[출력 형식]",
    "1) 시즌 핵심 요약 (2~3문장)",
    "2) 업적평가 후보 (3개 문장, 각 문장 120~180자)",
    "3) 역량평가 행동사례 후보 (4개 문장, 키워드: 도전/협업/성장/규정준수)",
    "4) 작성자 종합 의견 초안 (1개 문단, 300~500자)",
    "",
    `대상 시즌: ${year}년 ${seasonLabel(season)}`,
    `기록 개수: ${entries.length}`,
    "",
    "[기록 원문]",
    serializedEntries
  ].join("\n");
}

async function organizeWithGemini(prompt: string) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return null;

  const configuredModel = (process.env.GEMINI_MODEL ?? "gemini-1.5-flash")
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
            maxOutputTokens: 1400
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

async function organizeWithOpenAI(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const openai = new OpenAI({ apiKey });
  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    input: prompt
  });

  return response.output_text?.trim() || null;
}

async function runOrganize(prompt: string, preferred?: ProviderName) {
  const order: ProviderName[] = preferred
    ? [preferred, preferred === "gemini" ? "openai" : "gemini"]
    : ["gemini", "openai"];

  let lastError: Error | null = null;
  for (const provider of order) {
    try {
      const text =
        provider === "gemini" ? await organizeWithGemini(prompt) : await organizeWithOpenAI(prompt);
      if (!text) continue;
      return text;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("organize failed");
    }
  }
  if (lastError) throw lastError;
  return null;
}

export async function POST(req: Request) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "GOOGLE_GENERATIVE_AI_API_KEY 또는 OPENAI_API_KEY가 필요합니다." },
      { status: 500 }
    );
  }

  let body: OrganizeRequestBody;
  try {
    body = (await req.json()) as OrganizeRequestBody;
  } catch {
    return NextResponse.json({ error: "잘못된 JSON 요청입니다." }, { status: 400 });
  }

  const entries = body.entries ?? [];
  if (!entries.length) {
    return NextResponse.json({ error: "정리할 기록이 없습니다." }, { status: 400 });
  }

  const year = body.year ?? new Date().getFullYear();
  const season = body.season ?? "all";
  const prompt = buildOrganizePrompt(year, season, entries);

  try {
    const draft = await runOrganize(prompt);
    if (!draft) {
      return NextResponse.json({ error: "AI 응답이 비어 있습니다." }, { status: 502 });
    }
    return NextResponse.json({ draft });
  } catch (error) {
    console.error("Failed to organize work log", error);
    return NextResponse.json({ error: "시즌 정리 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}
