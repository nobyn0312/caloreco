-- ステップ1: まずこれだけ実行（1テーブルテスト）
-- 結果に caloreco_test と表示されれば SQL Editor は正常です

CREATE TABLE IF NOT EXISTS caloreco_test (
  id SERIAL PRIMARY KEY,
  note TEXT NOT NULL DEFAULT 'ok'
);

SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
