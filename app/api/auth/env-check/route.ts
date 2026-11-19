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
  const providers = getAuthOptions().providers.map((p) => {
    const anyP = p as { id?: string; options?: { id?: string } };
    return anyP.id ?? anyP.options?.id ?? "unknown";
  });

  return NextResponse.json({
    hasGoogleClientId: id.length > 0,
    hasGoogleClientSecret: secret.length > 0,
    googleClientIdLooksValid: id.includes(".apps.googleusercontent.com"),
    hasNextAuthUrl: nextAuthUrl.length > 0,
    nextAuthUrlIsLocalhost: nextAuthUrl.includes("localhost"),
    nextAuthUrlHost: (() => {
      try {
        return nextAuthUrl ? new URL(nextAuthUrl).host : null;
      } catch {
        return "invalid";
      }
    })(),
    providerIds: providers,
  });
}
