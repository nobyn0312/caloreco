import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";


function authSecret(): string | undefined {
  const fromEnv = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim();
  if (process.env.NODE_ENV === "development") {
    return "__caloreco_local_dev_secret_change_in_env_for_production__";
  }
  return undefined;
}

function googleEnabled(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()
  );
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
  const { googleId, email, name } = params;

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
      // 体型プロフィールは後で /account などで入力
      age: null,
      gender: null,
      heightCm: null,
      weightKg: null,
    },
  });
}

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

if (googleEnabled()) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  );
}

export const authOptions: NextAuthOptions = {
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
