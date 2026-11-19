import type { MealLog } from "@/lib/mealLogTypes";

const STORAGE_KEY = "caloreco:meal-logs:v1";

type CachePayload = {
  userId: string;
  logs: MealLog[];
  savedAt: number;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isMealLog(value: unknown): value is MealLog {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.id === "number" &&
    typeof o.rawInput === "string" &&
    typeof o.createdAt === "string" &&
    "result" in o
  );
}

export function readMealLogCache(userId: string): MealLog[] | null {
  if (!canUseStorage() || !userId) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachePayload>;
    if (parsed.userId !== userId || !Array.isArray(parsed.logs)) return null;
    if (!parsed.logs.every(isMealLog)) return null;
    return parsed.logs;
  } catch {
    return null;
  }
}

export function writeMealLogCache(userId: string, logs: MealLog[]): void {
  if (!canUseStorage() || !userId) return;
  try {
    const payload: CachePayload = {
      userId,
      logs,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // quota / private mode
  }
}

export function clearMealLogCache(): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
