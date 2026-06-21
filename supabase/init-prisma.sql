-- =============================================================================
-- 方式 A: 現行アプリ（NextAuth + Credentials + Prisma）
-- prisma/schema.prisma のテーブル名・カラム名に合わせています。
-- =============================================================================

-- updatedAt 自動更新（Supabase SQL / Table Editor から更新するとき用）
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- User（Prisma の model User に対応。Supabase 単体なら users 推奨 → 方式 B を参照）
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "gender" TEXT NOT NULL,
    "heightCm" DOUBLE PRECISION NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "targetProteinG" DOUBLE PRECISION,
    "targetFatG" DOUBLE PRECISION,
    "targetCarbsG" DOUBLE PRECISION,
    "targetKcal" DOUBLE PRECISION,
    "pfcSetAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "targetWeightKg" DOUBLE PRECISION,
    "bodyGoal" TEXT,
    "activityLevel" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

DROP TRIGGER IF EXISTS user_updated_at ON "User";
CREATE TRIGGER user_updated_at
    BEFORE UPDATE ON "User"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Memo
CREATE TABLE IF NOT EXISTS "Memo" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "userId" TEXT NOT NULL,

    CONSTRAINT "Memo_pkey" PRIMARY KEY ("id")
);

-- MealLog
CREATE TABLE IF NOT EXISTS "MealLog" (
    "id" SERIAL NOT NULL,
    "rawInput" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "totalKcal" DOUBLE PRECISION,
    "totalP" DOUBLE PRECISION,
    "totalF" DOUBLE PRECISION,
    "totalC" DOUBLE PRECISION,
    "userId" TEXT,

    CONSTRAINT "MealLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MealLog_createdAt_idx" ON "MealLog"("createdAt");
CREATE INDEX IF NOT EXISTS "MealLog_userId_idx" ON "MealLog"("userId");

ALTER TABLE "MealLog" DROP CONSTRAINT IF EXISTS "MealLog_userId_fkey";
ALTER TABLE "MealLog"
    ADD CONSTRAINT "MealLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Prisma migrate deploy を使う場合（任意）
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);

-- -----------------------------------------------------------------------------
-- RLS について（方式 A）
-- Next.js API は postgres / service_role 接続のため RLS をバイパスします。
-- Supabase Client（anon key）をブラウザから直接使う場合のみ、下記を有効化してください。
-- userId は cuid（auth.uid() とは不一致）のため、方式 A では auth.uid() ポリシーは使えません。
-- -----------------------------------------------------------------------------
-- ALTER TABLE "MealLog" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "Memo" ENABLE ROW LEVEL SECURITY;
