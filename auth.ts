import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { UserStatus, SESSION_MAX_AGE_SECONDS } from "@/lib/types";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const db = await getDb();
        const user = await db.query.users.findFirst({
          where: eq(users.username, credentials.username as string)
        });

        if (!user || user.status !== UserStatus.APPROVED) {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) {
          return null;
        }

        return {
          id: user.id.toString(),
          name: user.name,
          email: user.email,
          username: user.username,
          role: user.role,
          tenantId: user.tenantId
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token }) {
      // Re-validate user status from DB on every token refresh.
      // This ensures suspended/rejected users are forcibly logged out.
      if (token.sub) {
        const db = await getDb();
        const user = await db.query.users.findFirst({
          where: eq(users.id, Number(token.sub))
        });

        if (!user || user.status !== UserStatus.APPROVED) {
          // Return empty token to force sign-out
          return { ...token, expired: true };
        }

        // Keep fields in sync with DB
        token.role = user.role;
        token.email = user.email;
        token.username = user.username;
        token.tenantId = user.tenantId;
      }
      return token;
    },
    async session({ session, token }) {
      // If user was marked expired (suspended/rejected), invalidate session
      if (token.expired) {
        return { ...session, user: undefined } as unknown as typeof session;
      }

      if (session.user) {
        const user = session.user as unknown as Record<string, unknown>;
        user.role = token.role;
        user.email = token.email;
        user.username = token.username;
        user.tenantId = token.tenantId;
        user.id = token.sub;
      }
      return session;
    }
  },
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS
  },
  pages: {
    signIn: "/auth/sign-in"
  }
});
