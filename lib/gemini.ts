import { GoogleGenerativeAI } from "@google/generative-ai";

/** 速さ優先の候補（混雑時は次へ） */
export const GEMINI_FAST_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.8-flash",
] as const;

const DEFAULT_TIMEOUT_MS = 12_000;

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

function getUpstreamStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const anyErr = error as { status?: unknown; cause?: unknown };
  if (typeof anyErr.status === "number") return anyErr.status;
  if (anyErr.cause && typeof anyErr.cause === "object") {
    const c = anyErr.cause as { status?: unknown };
    if (typeof c.status === "number") return c.status;
  }
  return null;
}

function isRetryable(error: unknown): boolean {
  const status = getUpstreamStatus(error);
  if (status === 404 || status === 429 || status === 503 || status === 504) {
    return true;
  }
  if (error instanceof Error && error.message.includes("timed out")) {
    return true;
  }
  return false;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * GEMINI_MODEL:
 * - 未設定 / "auto" → 速さ優先で複数モデルを順に試す
 * - それ以外 → 指定モデルのみ
 */
export function resolveGeminiModels(envValue = process.env.GEMINI_MODEL): string[] {
  const raw = envValue?.trim();
  if (!raw || raw.toLowerCase() === "auto") {
    return [...GEMINI_FAST_MODELS];
  }
  return [raw];
}

export type GeminiGenerateResult = Awaited<
  ReturnType<ReturnType<GoogleGenerativeAI["getGenerativeModel"]>["generateContent"]>
>;

export async function generateContentAuto(options: {
  apiKey: string;
  prompt: string;
  responseMimeType?: "application/json" | "text/plain";
  timeoutMs?: number;
}): Promise<{ result: GeminiGenerateResult; model: string }> {
  const models = resolveGeminiModels();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const genAI = new GoogleGenerativeAI(options.apiKey);
  let lastError: unknown = null;

  for (let i = 0; i < models.length; i++) {
    const modelName = models[i];
    const model = genAI.getGenerativeModel({ model: modelName });
    try {
      const result = await Promise.race([
        model.generateContent({
          contents: [{ role: "user", parts: [{ text: options.prompt }] }],
          generationConfig: options.responseMimeType
            ? { responseMimeType: options.responseMimeType }
            : undefined,
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(
              Object.assign(new Error(`Gemini request timed out (${modelName})`), {
                status: 504,
              })
            );
          }, timeoutMs);
        }),
      ]);
      return { result, model: modelName };
    } catch (e) {
      lastError = e;
      if (isRetryable(e) && i < models.length - 1) {
        await sleep(200);
        continue;
      }
      throw e;
    }
  }

  throw lastError ?? new Error("Gemini model list was empty");
}

export { formatUnknownError, getUpstreamStatus, isRetryable };
