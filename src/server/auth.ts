import NextAuth, { type DefaultSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { env } from "@/env";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      corsairTenantId?: string | null;
      gmailConnected?: boolean;
      calendarConnected?: boolean;
    } & DefaultSession["user"];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
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
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user && user) {
        const dbUser = user as typeof users.$inferSelect;
        session.user.id = dbUser.id;
        session.user.corsairTenantId = dbUser.corsairTenantId;
        session.user.gmailConnected = dbUser.gmailConnected ?? false;
        session.user.calendarConnected = dbUser.calendarConnected ?? false;
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
