"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, getProviders } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const inputClass =
  "w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");
  const authError = searchParams.get("error");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() => {
    if (!authError) return null;
    if (authError === "AccessDenied") {
      return "Google ログインは拒否されました。DATABASE_URL / DIRECT_URL（パスワード含む）を確認し、npm run dev を再起動してからもう一度お試しください。ユーザー作成に失敗するとこのエラーになります。";
    }
    if (authError === "OAuthAccountNotLinked") {
      return "このメールは別の方法で登録済みの可能性があります。";
    }
    if (authError === "Configuration") {
      return "認証設定エラーです。GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / NEXTAUTH_URL を確認してください。";
    }
    return `Google ログインに失敗しました（${authError}）。もう一度お試しください。`;
  });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const providers = await getProviders();
        setGoogleAvailable(Boolean(providers?.google));
      } catch {
        setGoogleAvailable(false);
      }
    })();
  }, []);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        username: username.trim(),
        password,
        redirect: false,
        callbackUrl: "/",
      });
      if (res?.error) {
        setError("ユーザー名またはパスワードが正しくありません。");
        return;
      }
      if (res?.ok) {
        router.push(res.url ?? "/");
        router.refresh();
      }
    } catch {
      setError("通信に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await signIn("google", { callbackUrl: "/" });
    } catch {
      setError("Google ログインを開始できませんでした。");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>ログイン</CardTitle>
            {registered ? (
              <p className="text-sm font-medium text-emerald-800">登録が完了しました。ログインしてください。</p>
            ) : (
              <p className="text-sm text-neutral-600">
                ユーザー名とパスワード、または Google アカウントでログインできます。
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {googleAvailable ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => void loginWithGoogle()}
                disabled={loading || googleLoading}
              >
                {googleLoading ? "Googleへ移動中…" : "Googleでログイン"}
              </Button>
            ) : googleAvailable === false ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                Google ログインは未設定です。Vercel の Environment Variables に{" "}
                <code className="rounded bg-amber-100 px-1">GOOGLE_CLIENT_ID</code> と{" "}
                <code className="rounded bg-amber-100 px-1">GOOGLE_CLIENT_SECRET</code>{" "}
                を追加し、Redeploy してください。
              </p>
            ) : (
              <p className="text-sm text-neutral-500">認証方法を確認中…</p>
            )}

            {googleAvailable ? (
              <div className="relative py-1 text-center text-xs text-neutral-400">
                <span className="bg-white px-2 relative z-10">または</span>
                <span className="absolute left-0 right-0 top-1/2 border-t border-neutral-200" />
              </div>
            ) : null}

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">ユーザー名</label>
              <input className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">パスワード</label>
              <input
                type="password"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submit();
                }}
              />
            </div>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <Button type="button" onClick={() => void submit()} disabled={loading || googleLoading}>
              {loading ? "ログイン中…" : "ログイン"}
            </Button>
            <p className="text-center text-sm text-neutral-600">
              アカウントをお持ちでない方は{" "}
              <Link href="/register" className="font-medium text-neutral-900 underline">
                新規登録
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-50 p-6 text-center text-sm">読み込み中…</div>}>
      <LoginForm />
    </Suspense>
  );
}
