-- Caloreco 初期スキーマ（NextAuth + Prisma 用）
-- 【重要】全文をコピーして貼り付け、選択範囲は外してから Run（Without RLS）
-- 最後の SELECT で 4 行返れば成功です

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

CREATE TABLE IF NOT EXISTS "Memo" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "userId" TEXT NOT NULL,
    CONSTRAINT "Memo_pkey" PRIMARY KEY ("id")
);

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

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_updated_at ON "User";
CREATE TRIGGER user_updated_at
    BEFORE UPDATE ON "User"
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at();

-- 成功確認（この SELECT で行が返るはず）
SELECT tablename AS created_table
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('User', 'Memo', 'MealLog', '_prisma_migrations')
ORDER BY tablename;
