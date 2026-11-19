import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

/**
 * JWT の署名・検証に必須。未設定だと App Router の `getServerSession` が常に null になり、
 * `/api/me` などが 401 になる一方、ブラウザのセッション表示だけ動くことがある。
 * 本番では必ず NEXTAUTH_SECRET（または AUTH_SECRET）を環境変数で設定すること。
 */
function authSecret(): string | undefined {
  const fromEnv = process.env["NEXTAUTH_SECRET"] ?? process.env["AUTH_SECRET"];
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim();
  if (process.env.NODE_ENV === "development") {
    return "__caloreco_local_dev_secret_change_in_env_for_production__";
  }
  return undefined;
}

/** ブラケット参照にして、ビルド時の空文字インライン化を避ける */
function googleCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env["GOOGLE_CLIENT_ID"]?.trim();
  const clientSecret = process.env["GOOGLE_CLIENT_SECRET"]?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

async function uniqueUsernameFromEmail(email: string): Promise<string> {
  const local = email.split("@")[0] ?? "user";
  const base = local
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 20);
  const seed = base.length >= 3 ? base : `user_${base || "g"}`;

  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? seed : `${seed}_${i}`.slice(0, 30);
    const exists = await prisma.user.findUnique({ where: { username: candidate } });
    if (!exists) return candidate;
  }

  return `g_${Date.now().toString(36)}`.slice(0, 30);
}

async function findOrCreateGoogleUser(params: {
  googleId: string;
  email: string;
  name?: string | null;
}) {
  const { googleId, email } = params;

  const existing =
    (await prisma.user.findUnique({ where: { googleId } })) ??
    (await prisma.user.findUnique({ where: { email } }));

  if (existing) {
    if (!existing.googleId || !existing.email) {
      return prisma.user.update({
        where: { id: existing.id },
        data: {
          googleId: existing.googleId ?? googleId,
          email: existing.email ?? email,
        },
      });
    }
    return existing;
  }

  const username = await uniqueUsernameFromEmail(email);
  return prisma.user.create({
    data: {
      username,
      email,
      googleId,
      passwordHash: null,
      age: null,
      gender: null,
      heightCm: null,
      weightKg: null,
    },
  });
}

/** リクエストごとに組み立てる（Vercel でビルド時に Google が落ちるのを防ぐ） */
export function getAuthOptions(): NextAuthOptions {
  const providers: NextAuthOptions["providers"] = [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "ユーザー名", type: "text" },
        password: { label: "パスワード", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username?.trim();
        const password = credentials?.password;
        if (!username || !password) return null;

        const user = await prisma.user.findUnique({ where: { username } });
        if (!user?.passwordHash) return null;
        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          name: user.username,
          email: user.email,
        };
      },
    }),
  ];

  const google = googleCredentials();
  if (google) {
    providers.push(
      GoogleProvider({
        clientId: google.clientId,
        clientSecret: google.clientSecret,
      })
    );
  }

  return {
    session: {
      strategy: "jwt",
      maxAge: 30 * 24 * 60 * 60,
    },
    secret: authSecret(),
    pages: {
      signIn: "/login",
      error: "/login",
    },
    providers,
    callbacks: {
      async signIn({ account, profile }) {
        if (account?.provider !== "google") return true;

        const email = profile?.email;
        const googleId = account.providerAccountId;
        if (!email || !googleId) return false;

        try {
          await findOrCreateGoogleUser({
            googleId,
            email,
            name: profile?.name,
          });
          return true;
        } catch (e) {
          console.error("Google signIn user upsert failed:", e);
          return false;
        }
      },
      async jwt({ token, user, account, profile }) {
        if (user?.id) {
          token.id = user.id;
          token.sub = user.id;
        }

        if (account?.provider === "google") {
          const email = profile?.email;
          const googleId = account.providerAccountId;
          if (email && googleId) {
            const dbUser = await findOrCreateGoogleUser({
              googleId,
              email,
              name: profile?.name,
            });
            token.id = dbUser.id;
            token.sub = dbUser.id;
            token.name = dbUser.username;
            token.email = dbUser.email;
          }
        }

        return token;
      },
      async session({ session, token }) {
        if (session.user && token.id) {
          session.user.id = token.id as string;
        }
        if (session.user && token.name) {
          session.user.name = token.name as string;
        }
        if (session.user && token.email) {
          session.user.email = token.email as string;
        }
        return session;
      },
    },
  };
}

/** 互換用。中身は都度 getAuthOptions() を参照 */
export const authOptions: NextAuthOptions = new Proxy({} as NextAuthOptions, {
  get(_target, prop, receiver) {
    const options = getAuthOptions();
    const value = Reflect.get(options, prop, receiver);
    return typeof value === "function" ? value.bind(options) : value;
  },
  ownKeys() {
    return Reflect.ownKeys(getAuthOptions());
  },
  getOwnPropertyDescriptor(_target, prop) {
    return Reflect.getOwnPropertyDescriptor(getAuthOptions(), prop);
  },
});
