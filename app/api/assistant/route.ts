import { AssistantResponse } from "ai";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { buildEvaluationPrompt } from "@/lib/assistants/prompts";
import { COMPETENCY_RULES, KPI_RULES } from "@/lib/constants/evaluation-rules";

export const runtime = "nodejs";
export const maxDuration = 60;

type AssistantRequestBody = {
  threadId?: string | null;
  message: string;
  track: "performance" | "competency";
  meta?: {
    year?: number;
    department?: string;
    jobFamily?: string;
  };
};

function getGuidelineFileIds() {
  return (process.env.OPENAI_GUIDELINE_FILE_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export async function POST(req: Request) {
  const assistantId = process.env.OPENAI_ASSISTANT_ID;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!assistantId || !apiKey) {
    return NextResponse.json(
      {
        error: "Missing OPENAI_API_KEY or OPENAI_ASSISTANT_ID. Check .env.local."
      },
      { status: 500 }
    );
  }

  let body: AssistantRequestBody;

  try {
    body = (await req.json()) as AssistantRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!body?.message?.trim()) {
    return NextResponse.json({ error: "message is required." }, { status: 400 });
  }

  if (body.track !== "performance" && body.track !== "competency") {
    return NextResponse.json({ error: "track must be performance or competency." }, { status: 400 });
  }

  const prompt = buildEvaluationPrompt({
    track: body.track,
    message: body.message,
    rules: {
      kpi: KPI_RULES,
      competency: COMPETENCY_RULES
    },
    meta: body.meta
  });

  const openai = new OpenAI({ apiKey });
  const guidelineFileIds = getGuidelineFileIds();

  const threadId =
    body.threadId ??
    (
      await openai.beta.threads.create({
        metadata: {
          track: body.track,
          source: "nextjs-internal-evaluation-tool"
        }
      })
    ).id;

  const createdMessage = await openai.beta.threads.messages.create(threadId, {
    role: "user",
    content: prompt,
    attachments: guidelineFileIds.map((fileId) => ({
      file_id: fileId,
      tools: [{ type: "file_search" }]
    }))
  });

  return AssistantResponse(
    { threadId, messageId: createdMessage.id },
    async ({ forwardStream }) => {
      const runStream = openai.beta.threads.runs.stream(threadId, {
        assistant_id: assistantId
      });

      let runResult = await forwardStream(runStream);

      while (
        runResult?.status === "requires_action" &&
        runResult.required_action?.type === "submit_tool_outputs"
      ) {
        const toolCalls = runResult.required_action.submit_tool_outputs.tool_calls as Array<{
          id: string;
          function: { name: string };
        }>;

        const toolOutputs = toolCalls.map((call) => ({
          tool_call_id: call.id,
          output: JSON.stringify({
            ok: false,
            message: `Tool "${call.function.name}" is not implemented on this endpoint yet.`
          })
        }));

        runResult = await forwardStream(
          openai.beta.threads.runs.submitToolOutputsStream(
            threadId,
            runResult.id,
            { tool_outputs: toolOutputs } as any
          )
        );
      }
    }
  );
}
