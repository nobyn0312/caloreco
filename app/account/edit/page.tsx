"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const inputClass =
  "w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 md:text-sm";

type MeUser = {
  username: string;
  age: number | null;
  gender: string | null;
  heightCm: number | null;
  weightKg: number | null;
  targetWeightKg: number | null;
};

function numToInput(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  const s = String(n);
  return s;
}

export default function AccountEditPage() {
  const router = useRouter();
  const { status } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("unspecified");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [targetWeightKg, setTargetWeightKg] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      setLoading(false);
      return;
    }
    if (status !== "authenticated") return;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/me", { credentials: "include" });
        const data = (await res.json()) as { user?: MeUser; error?: string };
        if (!res.ok || !data.user) {
          setError(typeof data.error === "string" ? data.error : "読み込みに失敗しました。");
          return;
        }
        const u = data.user;
        setUsername(u.username);
        setAge(numToInput(u.age));
        setGender(u.gender && ["male", "female", "other", "unspecified"].includes(u.gender) ? u.gender : "unspecified");
        setHeightCm(numToInput(u.heightCm));
        setWeightKg(numToInput(u.weightKg));
        setTargetWeightKg(numToInput(u.targetWeightKg));
      } catch {
        setError("通信に失敗しました。");
      } finally {
        setLoading(false);
      }
    })();
  }, [status]);

  const submit = async () => {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          age: age.trim() === "" ? null : Number(age),
          gender,
          heightCm: heightCm.trim() === "" ? null : Number(heightCm),
          weightKg: weightKg.trim() === "" ? null : Number(weightKg),
          targetWeightKg: targetWeightKg.trim() === "" ? null : Number(targetWeightKg),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "保存に失敗しました。");
        return;
      }
      router.push("/account");
      router.refresh();
    } catch {
      setError("通信に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div className="min-h-screen bg-neutral-50 px-4 py-4 text-center text-sm text-neutral-600 sm:px-6 sm:py-6">
        読み込み中…
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-neutral-50 px-4 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto max-w-md text-center">
          <p className="text-neutral-700">ログインが必要です。</p>
          <Link href="/login" className="mt-4 inline-block font-medium text-neutral-900 underline">
            ログインへ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto w-full max-w-md space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>アカウント編集</CardTitle>
            <p className="text-sm text-neutral-600">
              身長・体重・年齢・性別を登録・更新できます。目標体重は任意です。
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">名前</label>
              <p className="rounded-md border border-neutral-100 bg-neutral-50 px-3 py-2 text-sm text-neutral-800">
                {username || "—"}
              </p>
            </div>
            <div>
              <label htmlFor="edit-age" className="mb-1 block text-xs font-medium text-neutral-600">
                年齢
              </label>
              <input
                id="edit-age"
                className={inputClass}
                type="number"
                inputMode="numeric"
                min={10}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="edit-gender" className="mb-1 block text-xs font-medium text-neutral-600">
                性別
              </label>
              <select
                id="edit-gender"
                className={inputClass}
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="unspecified">回答しない</option>
                <option value="male">男性</option>
                <option value="female">女性</option>
                <option value="other">その他</option>
              </select>
            </div>
            <div>
              <label htmlFor="edit-height" className="mb-1 block text-xs font-medium text-neutral-600">
                身長（cm）
              </label>
              <input
                id="edit-height"
                className={inputClass}
                type="number"
                inputMode="decimal"
                min={100}
                max={250}
                step="0.1"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="edit-weight" className="mb-1 block text-xs font-medium text-neutral-600">
                体重（kg）
              </label>
              <input
                id="edit-weight"
                className={inputClass}
                type="number"
                inputMode="decimal"
                min={25}
                max={250}
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="edit-target-weight"
                className="mb-1 block text-xs font-medium text-neutral-600"
              >
                目標体重（kg・任意）
              </label>
              <input
                id="edit-target-weight"
                className={inputClass}
                type="number"
                inputMode="decimal"
                min={25}
                max={250}
                step="0.1"
                value={targetWeightKg}
                onChange={(e) => setTargetWeightKg(e.target.value)}
                placeholder="未設定の場合は空欄"
              />
            </div>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={() => void submit()}
                disabled={saving}
              >
                {saving ? "保存中…" : "保存する"}
              </Button>
              <Link href="/account" className="w-full sm:w-auto">
                <Button type="button" variant="outline" className="w-full" disabled={saving}>
                  キャンセル
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
