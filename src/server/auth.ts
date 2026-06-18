import NextAuth, { type DefaultSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/server/db";
import { users, accounts, sessions, verificationTokens } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { env } from "@/env";
import { provisionCorsairTenant } from "@/server/lib/corsair-setup";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      corsairTenantId?: string | null;
      gmailConnected?: boolean;
      calendarConnected?: boolean;
      isStaff?: boolean;
      suspendedAt?: string | null;
    } & DefaultSession["user"];
  }
}

import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, { usersTable: users, accountsTable: accounts, sessionsTable: sessions, verificationTokensTable: verificationTokens }),
  session: { strategy: "jwt" },
  providers: [
    GoogleProvider({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          scope: "openid email profile https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets.readonly",
        },
      },
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        const user = await db.query.users.findFirst({
          where: eq(users.email, credentials.email as string)
        });

        if (!user || !user.passwordHash) {
          throw new Error("Invalid credentials");
        }

        const isCorrectPassword = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isCorrectPassword) {
          throw new Error("Invalid credentials");
        }

        return user;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // credentials authorize returns user, Google provider returns user on sign in
        const dbUser = user as typeof users.$inferSelect;
        token.id = dbUser.id;
        token.corsairTenantId = dbUser.corsairTenantId;
        token.gmailConnected = dbUser.gmailConnected ?? false;
        token.calendarConnected = dbUser.calendarConnected ?? false;
      }

      if (token.id) {
        const dbUser = await db.query.users.findFirst({
          where: eq(users.id, token.id as string)
        });
        if (dbUser) {
          const adminEmails = env.PRODUCT_ADMIN_EMAILS
            ? env.PRODUCT_ADMIN_EMAILS.split(",").map(e => e.trim().toLowerCase())
            : [];
          token.isStaff = dbUser.isStaff === true || (dbUser.email && adminEmails.includes(dbUser.email.toLowerCase())) || false;
          token.suspendedAt = dbUser.suspendedAt ? dbUser.suspendedAt.toISOString() : null;
          token.gmailConnected = dbUser.gmailConnected ?? false;
          token.calendarConnected = dbUser.calendarConnected ?? false;
          token.corsairTenantId = dbUser.corsairTenantId;
        } else {
          token.isStaff = false;
          token.suspendedAt = null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.corsairTenantId = token.corsairTenantId as string | null | undefined;
        session.user.gmailConnected = token.gmailConnected as boolean | undefined;
        session.user.calendarConnected = token.calendarConnected as boolean | undefined;
        session.user.isStaff = token.isStaff as boolean | undefined;
        session.user.suspendedAt = token.suspendedAt as string | null | undefined;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id) return;
      const tenantId = `user_${user.id.replace(/-/g, "")}`;
      const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const trialStartedAt = new Date();

      await db
        .update(users)
        .set({
          corsairTenantId: tenantId,
          referralCode,
          trialStartedAt,
        })
        .where(eq(users.id, user.id));
    },

    async signIn({ user, account }) {
      // DrizzleAdapter only calls linkAccount on first sign-in — subsequent Google
      // sign-ins do NOT update the accounts table. We manually refresh the tokens
      // here so refreshCorsairTokens always reads a valid access_token/refresh_token.
      if (account?.provider === "google" && user.id && account.access_token) {
        try {
          await db
            .update(accounts)
            .set({
              access_token: account.access_token,
              refresh_token: account.refresh_token ?? undefined,
              expires_at: account.expires_at ?? undefined,
              token_type: account.token_type ?? undefined,
              scope: account.scope ?? undefined,
            })
            .where(
              and(
                eq(accounts.userId, user.id),
                eq(accounts.provider, "google"),
              ),
            );

          // Re-provision Corsair with the fresh tokens so the inbox works immediately
          // after reconnecting without needing a manual sync click.
          const dbUser = await db.query.users.findFirst({
            where: eq(users.id, user.id),
          });
          if (dbUser?.corsairTenantId) {
            await provisionCorsairTenant(user.id, dbUser.corsairTenantId, env.CORSAIR_KEK);
          }
        } catch (err) {
          // Non-fatal — log server-side but don't block sign-in
          console.error("[auth] Failed to refresh Corsair tokens on sign-in:", err);
        }
      }
    },
  },
});
