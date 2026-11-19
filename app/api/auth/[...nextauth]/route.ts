import type { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { getAuthOptions } from "@/lib/auth";

type RouteContext = { params: Promise<{ nextauth: string[] }> };

async function auth(req: NextRequest, context: RouteContext) {
  // 毎リクエストで options を組み立て、Vercel の GOOGLE_* を確実に反映する
  return NextAuth(getAuthOptions())(req, context);
}

export { auth as GET, auth as POST };
