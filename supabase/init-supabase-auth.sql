-- =============================================================================
-- 方式 B: Supabase Auth + profiles（推奨・新規 Supabase プロジェクト向け）
-- auth.users を認証に使い、プロフィール・食事ログはアプリ用テーブルに分離します。
-- ※ この方式を使う場合、アプリ側を Supabase Auth + profiles 参照に改修する必要があります。
-- =============================================================================

-- updatedAt 自動更新
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- プロフィール（auth.users と 1:1）
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    age INTEGER NOT NULL,
    gender TEXT NOT NULL,
    height_cm DOUBLE PRECISION NOT NULL,
    weight_kg DOUBLE PRECISION NOT NULL,
    target_protein_g DOUBLE PRECISION,
    target_fat_g DOUBLE PRECISION,
    target_carbs_g DOUBLE PRECISION,
    target_kcal DOUBLE PRECISION,
    pfc_set_at TIMESTAMPTZ,
    target_weight_kg DOUBLE PRECISION,
    body_goal TEXT,
    activity_level TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- 新規サインアップ時に profiles 行を自動作成（username 等はアプリ側で UPDATE）
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, age, gender, height_cm, weight_kg)
    VALUES (NEW.id, 0, 'unknown', 0, 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- メモ
CREATE TABLE IF NOT EXISTS memos (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 食事ログ
CREATE TABLE IF NOT EXISTS meal_logs (
    id BIGSERIAL PRIMARY KEY,
    raw_input TEXT NOT NULL,
    result JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    total_kcal DOUBLE PRECISION,
    total_p DOUBLE PRECISION,
    total_f DOUBLE PRECISION,
    total_c DOUBLE PRECISION,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS meal_logs_created_at_idx ON meal_logs(created_at);
CREATE INDEX IF NOT EXISTS meal_logs_user_id_idx ON meal_logs(user_id);

-- =============================================================================
-- Row Level Security（必須）
-- =============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_logs ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- memos
DROP POLICY IF EXISTS "Users can manage own memos" ON memos;
CREATE POLICY "Users can manage own memos"
    ON memos FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- meal_logs
DROP POLICY IF EXISTS "Users can manage own meals" ON meal_logs;
CREATE POLICY "Users can manage own meals"
    ON meal_logs FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
