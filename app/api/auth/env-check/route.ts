import { NextResponse } from "next/server";
import { getAuthOptions } from "@/lib/auth";

/**
 * 本番デバッグ用（秘密は返さない）。
 * GET /api/auth/env-check
 */
export async function GET() {
  const id = process.env["GOOGLE_CLIENT_ID"]?.trim() ?? "";
  const secret = process.env["GOOGLE_CLIENT_SECRET"]?.trim() ?? "";
  const nextAuthUrl = process.env["NEXTAUTH_URL"]?.trim() ?? "";
  const nextAuthSecret =
    process.env["NEXTAUTH_SECRET"]?.trim() ?? process.env["AUTH_SECRET"]?.trim() ?? "";
  const databaseUrl = process.env["DATABASE_URL"]?.trim() ?? "";
  const directUrl = process.env["DIRECT_URL"]?.trim() ?? "";
  const providers = getAuthOptions().providers.map((p) => {
    const anyP = p as { id?: string; options?: { id?: string } };
    return anyP.id ?? anyP.options?.id ?? "unknown";
  });

  let dbPing: { ok: boolean; error?: string } = { ok: false };
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$queryRaw`SELECT 1`;
    const users = await prisma.user.count();
    dbPing = { ok: true, error: `users=${users}` };
  } catch (e) {
    dbPing = {
      ok: false,
      error: e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200),
    };
  }

  const hints: string[] = [];
  if (nextAuthSecret.length === 0) {
    hints.push("NEXTAUTH_SECRET が未設定です。");
  }
  if (databaseUrl.length === 0) {
    hints.push("DATABASE_URL が未設定です。");
  }
  if (directUrl.length === 0) {
    hints.push("DIRECT_URL が未設定です（migrate / 一部接続で必要）。");
  }
  if (!dbPing.ok) {
    hints.push("DB接続に失敗しています。DATABASE_URL（Supabase pooler）を確認してください。");
  }

  return NextResponse.json({
    hasGoogleClientId: id.length > 0,
    hasGoogleClientSecret: secret.length > 0,
    googleClientIdLooksValid: id.includes(".apps.googleusercontent.com"),
    hasNextAuthUrl: nextAuthUrl.length > 0,
    hasNextAuthSecret: nextAuthSecret.length > 0,
    hasDatabaseUrl: databaseUrl.length > 0,
    hasDirectUrl: directUrl.length > 0,
    databaseHost: (() => {
      try {
        return databaseUrl
          ? new URL(databaseUrl.replace(/^postgresql:/, "postgres:")).host
          : null;
      } catch {
        return "invalid";
      }
    })(),
    nextAuthUrlIsLocalhost: nextAuthUrl.includes("localhost"),
    nextAuthUrlHost: (() => {
      try {
        return nextAuthUrl ? new URL(nextAuthUrl).host : null;
      } catch {
        return "invalid";
      }
    })(),
    providerIds: providers,
    dbPing,
    hints,
  });
}
