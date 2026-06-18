import NextAuth, { type DefaultSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/server/db";
import { users, accounts, sessions, verificationTokens } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { env } from "@/env";

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
  },
});
