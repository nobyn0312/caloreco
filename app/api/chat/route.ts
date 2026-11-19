import { NextRequest, NextResponse } from "next/server";
import {
  formatUnknownError,
  generateContentAuto,
  getUpstreamStatus,
} from "@/lib/gemini";
import { coerceNutrition, type NutritionJson } from "@/lib/mealNutrition";

const MAX_MESSAGES = 24;

/** Vercel Hobby は短め。Pro なら最大60秒まで延ばせる */
export const maxDuration = 60;
export const runtime = "nodejs";

function extractTextFromGeminiResponse(result: {
  response: {
    text: () => string;
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    promptFeedback?: { blockReason?: string };
  };
}): string {
  try {
    const t = result.response.text();
    if (t?.trim()) return t;
  } catch {
    // ブロックや候補なしのとき text() が throw することがある
  }

  const block = result.response.promptFeedback?.blockReason;
  if (block) {
    return `安全性フィルタにより応答できませんでした（理由: ${block}）。別の言い方で試してください。`;
  }

  const parts = result.response.candidates?.[0]?.content?.parts;
  const joined = parts?.map((p) => p.text ?? "").join("") ?? "";
  if (joined.trim()) return joined;

  const finish = result.response.candidates?.[0]?.finishReason;
  if (finish && finish !== "STOP") {
    return `回答を生成できませんでした（finishReason: ${finish}）。`;
  }

  return "回答を生成できませんでした。";
}

/** Gemini の JSON（assistantMessage + foods + total + notes）を検証して返す */
function tryParseAssistantNutrition(text: string): {
  assistantMessage: string;
  nutrition: NutritionJson;
} | null {
  const trimmed = text.trim();
  let obj: unknown;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    obj = null;
  }
  if (obj === null) {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const sliced = trimmed.slice(start, end + 1);
      try {
        obj = JSON.parse(sliced);
      } catch {
        obj = null;
      }
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  if (!("total" in o) || !("foods" in o)) return null;

  const nutrition = coerceNutrition(o);
  const am = o.assistantMessage;
  const assistantMessage =
    typeof am === "string" && am.trim()
      ? am.trim()
      : "推定が完了しました。下記の内容を確認し、問題なければ記録してください。";

  return { assistantMessage, nutrition };
}

const MAX_TOTAL_CHARS = 48_000;

function normalizeChatMessages(body: unknown): { role: "user" | "assistant"; content: string }[] | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;

  if (Array.isArray(o.messages) && o.messages.length > 0) {
    if (o.messages.length > MAX_MESSAGES) return null;
    const out: { role: "user" | "assistant"; content: string }[] = [];
    for (const item of o.messages) {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const role = row.role;
      const content = row.content;
      if (role !== "user" && role !== "assistant") return null;
      if (typeof content !== "string") return null;
      const t = content.trim();
      if (!t) return null;
      out.push({ role, content: t });
    }
    if (out[0].role !== "user") return null;
    if (out[out.length - 1].role !== "user") return null;
    for (let i = 1; i < out.length; i++) {
      if (out[i].role === out[i - 1].role) return null;
    }
    let total = 0;
    for (const m of out) total += m.content.length;
    if (total > MAX_TOTAL_CHARS) return null;
    return out;
  }

  if (typeof o.message === "string" && o.message.trim()) {
    return [{ role: "user" as const, content: o.message.trim() }];
  }

  return null;
}

function buildPromptFromMessages(messages: { role: "user" | "assistant"; content: string }[]): string {
  if (messages.length === 1) {
    return messages[0].content;
  }
  const lines: string[] = [
    "以下はこれまでのユーザーとアシスタントのやりとりです。食事の説明や訂正が複数回に分かれています。すべてを統合して解釈してください。",
    "",
  ];
  for (let i = 0; i < messages.length - 1; i++) {
    const m = messages[i];
    lines.push(m.role === "user" ? `ユーザー: ${m.content}` : `アシスタント: ${m.content}`);
    lines.push("");
  }
  lines.push("いまのユーザー入力（最優先で反映してください）:");
  lines.push(messages[messages.length - 1].content);
  return lines.join("\n");
}

export async function POST(request: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY が設定されていません。プロジェクト直下の .env に GEMINI_API_KEY を書き、next dev を再起動してください。",
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const messages = normalizeChatMessages(body);
    if (!messages) {
      return NextResponse.json(
        {
          error:
            "messages 配列（user で始まり user で終わる交互）か、単独の message 文字列が必要です。",
        },
        { status: 400 }
      );
    }

    const userPrompt = buildPromptFromMessages(messages);

    const prompt = [
      "あなたは栄養士のアシスタントです。",
      "ユーザーの食事内容からカロリーとPFC（タンパク質/脂質/炭水化物）を推定し、次のJSONのみを返してください（説明文やMarkdownのコードフェンスは禁止）。",
      "",
      "必ず次の形にしてください:",
      "{",
      '  "assistantMessage": "ユーザー向けの説明文（日本語・2〜5文。推定の要点と注意点。JSONやキー名は書かない）",',
      '  "foods": [',
      '    { "name": "食品名", "amount": 0, "kcal": 0, "p": 0, "f": 0, "c": 0 }',
      "  ],",
      '  "total": { "kcal": 0, "p": 0, "f": 0, "c": 0 },',
      '  "notes": "推定の前提や追加質問(任意)"',
      "}",
      "",
      "assistantMessage は必須（string）。",
      "amount は分量の数値のみ（number）。単位語は入れない。",
      "kcal/p/f/c/amount は必ず number（文字列禁止）。p/f/c の単位は g、kcal は kcal。",
      "",
      "会話・入力:",
      userPrompt,
      "",
      "上記の会話と入力全体を踏まえて食事を推定し、指定の JSON のみを返してください。",
    ].join("\n");

    // GEMINI_MODEL=auto（または未設定）なら速さ優先でモデルを順に試す
    const { result, model } = await generateContentAuto({
      apiKey,
      prompt,
      responseMimeType: "application/json",
      timeoutMs: 12_000,
    });

    const raw = extractTextFromGeminiResponse(result);
    const parsed = tryParseAssistantNutrition(raw);

    if (!parsed) {
      return NextResponse.json(
        {
          error: "推定結果の解析に失敗しました。もう一度お試しください。",
          ...(isDev ? { raw, model } : {}),
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      assistantMessage: parsed.assistantMessage,
      nutrition: parsed.nutrition,
      ...(isDev ? { model } : {}),
    });
  } catch (error) {
    console.error("Gemini API error:", error);
    const details = formatUnknownError(error);
    const status = getUpstreamStatus(error);
    if (status === 503 || (error instanceof Error && error.message.includes("timed out"))) {
      return NextResponse.json(
        {
          error:
            "Gemini が混雑しているかタイムアウトしました。少し待ってからもう一度送信してください。",
          details,
        },
        { status: status === 503 ? 503 : 504, headers: { "Retry-After": "5" } }
      );
    }

    return NextResponse.json(
      {
        error: "AIからの応答取得に失敗しました",
        details,
      },
      { status: 500 }
    );
  }
}
