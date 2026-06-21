/**
 * Supabase / PostgreSQL 接続テスト
 * 使い方: node scripts/test-db-connection.mjs
 * .env の DATABASE_URL を使います（未設定時は PROJECT_ID + SUPABASE_PASSWORD から組み立て）
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

function loadEnv() {
  const path = resolve(process.cwd(), ".env");
  const text = readFileSync(path, "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return env;
}

function buildSupabaseUrl(projectId, password) {
  return `postgresql://postgres:${encodeURIComponent(password)}@db.${projectId}.supabase.co:5432/postgres?sslmode=require`;
}

const env = loadEnv();
const databaseUrl =
  env.DATABASE_URL?.includes("supabase") || env.DATABASE_URL?.includes("pooler")
    ? env.DATABASE_URL
    : env.PROJECT_ID && env.SUPABASE_PASSWORD
      ? buildSupabaseUrl(env.PROJECT_ID, env.SUPABASE_PASSWORD)
      : env.DATABASE_URL;

if (!databaseUrl) {
  console.error("❌ DATABASE_URL または PROJECT_ID + SUPABASE_PASSWORD が .env に必要です");
  process.exit(1);
}

const safeUrl = databaseUrl.replace(/:([^:@/]+)@/, ":***@");
console.log("接続先:", safeUrl);

const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl } },
});

try {
  const tables = await prisma.$queryRaw`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;
  console.log("✅ 接続成功");
  console.log("public スキーマのテーブル:");
  for (const row of tables) {
    console.log(" -", row.tablename);
  }
} catch (err) {
  console.error("❌ 接続失敗");
  if (String(err).includes("P1000") || String(err).includes("Authentication failed")) {
    console.error("   → パスワードが違います。Supabase Dashboard → Project Settings → Database");
    console.error("     で Database password を確認または Reset してください。");
  } else if (String(err).includes("ENOTFOUND") || String(err).includes("Can't reach")) {
    console.error("   → ホスト名または PROJECT_ID が違う可能性があります。");
  } else {
    console.error(err.message ?? err);
  }
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
