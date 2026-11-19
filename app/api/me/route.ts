import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const GENDERS = new Set(["male", "female", "other", "unspecified"]);

const userSelect = {
  id: true,
  username: true,
  age: true,
  gender: true,
  heightCm: true,
  weightKg: true,
  targetWeightKg: true,
  targetProteinG: true,
  targetFatG: true,
  targetCarbsG: true,
  targetKcal: true,
  pfcSetAt: true,
  createdAt: true,
} as const;

function parseOptionalNumber(
  value: unknown,
  opts: { min: number; max: number; integer?: boolean; label: string }
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (value === null || value === undefined || value === "") {
    return { ok: true, value: null };
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return { ok: false, error: `${opts.label}は数値で入力してください。` };
  }
  const v = opts.integer ? Math.round(n) : n;
  if (v < opts.min || v > opts.max) {
    return {
      ok: false,
      error: `${opts.label}は ${opts.min}〜${opts.max} の範囲で入力してください。`,
    };
  }
  return { ok: true, value: v };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: userSelect,
  });

  if (!user) {
    return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON ボディの解析に失敗しました。" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "リクエストが不正です。" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;

  const age = parseOptionalNumber(o.age, {
    min: 10,
    max: 120,
    integer: true,
    label: "年齢",
  });
  if (!age.ok) return NextResponse.json({ error: age.error }, { status: 400 });

  const heightCm = parseOptionalNumber(o.heightCm, {
    min: 100,
    max: 250,
    label: "身長",
  });
  if (!heightCm.ok) {
    return NextResponse.json({ error: heightCm.error }, { status: 400 });
  }

  const weightKg = parseOptionalNumber(o.weightKg, {
    min: 25,
    max: 250,
    label: "体重",
  });
  if (!weightKg.ok) {
    return NextResponse.json({ error: weightKg.error }, { status: 400 });
  }

  const targetWeightKg = parseOptionalNumber(o.targetWeightKg, {
    min: 25,
    max: 250,
    label: "目標体重",
  });
  if (!targetWeightKg.ok) {
    return NextResponse.json({ error: targetWeightKg.error }, { status: 400 });
  }

  let gender: string | null = null;
  if (o.gender !== null && o.gender !== undefined && o.gender !== "") {
    if (typeof o.gender !== "string" || !GENDERS.has(o.gender)) {
      return NextResponse.json({ error: "性別の値が不正です。" }, { status: 400 });
    }
    gender = o.gender;
  }

  // 必須: 身長・体重・年齢・性別
  if (age.value == null) {
    return NextResponse.json({ error: "年齢を入力してください。" }, { status: 400 });
  }
  if (!gender) {
    return NextResponse.json({ error: "性別を選択してください。" }, { status: 400 });
  }
  if (heightCm.value == null) {
    return NextResponse.json({ error: "身長を入力してください。" }, { status: 400 });
  }
  if (weightKg.value == null) {
    return NextResponse.json({ error: "体重を入力してください。" }, { status: 400 });
  }

  try {
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        age: age.value,
        gender,
        heightCm: heightCm.value,
        weightKg: weightKg.value,
        targetWeightKg: targetWeightKg.value,
      },
      select: userSelect,
    });
    return NextResponse.json({ user });
  } catch (error) {
    console.error("me PATCH error:", error);
    return NextResponse.json({ error: "プロフィールの更新に失敗しました。" }, { status: 500 });
  }
}
