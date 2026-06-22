import NextAuth, { type DefaultSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/server/db";
import { users, accounts, sessions, verificationTokens } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { env } from "@/env";
import { provisionCorsairTenant } from "@/server/lib/corsair-setup";
import { refreshGoogleAccessToken } from "@/server/lib/google-token";

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
    /** Set to "RefreshAccessTokenError" when the Google token refresh failed and
     *  the user must re-authenticate. The UI reads this to prompt a reconnect. */
    error?: "RefreshAccessTokenError";
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
    async jwt({ token, user, account }) {
      // On initial Google sign-in (and reconnect), the access/refresh tokens
      // arrive on `account`. Stash them on the JWT so later calls can detect
      // expiry and mint a fresh access token without a full re-auth.
      if (account?.provider === "google") {
        token.access_token = account.access_token;
        // Google only returns refresh_token on first consent; keep the old one.
        token.refresh_token =
          account.refresh_token ?? (token.refresh_token as string | undefined);
        token.expires_at = account.expires_at ?? undefined;
        delete token.error;
      }

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

      // Refresh the Google access token once it has expired. NextAuth's
      // DrizzleAdapter only writes the accounts row on the *initial* link, so
      // without this the row (and the credentials provisionCorsairTenant pushes
      // into Corsair) goes stale ~1h after sign-in. We compare in ms against the
      // seconds-based expires_at and refresh slightly early to avoid handing out
      // a token that expires mid-request.
      const EXPIRY_SKEW_MS = 60_000;
      const refreshToken = token.refresh_token as string | undefined;
      const expiresAt = token.expires_at as number | undefined;
      const userId = token.id as string | undefined;
      if (
        refreshToken &&
        expiresAt &&
        Date.now() >= expiresAt * 1000 - EXPIRY_SKEW_MS
      ) {
        try {
          const refreshed = await refreshGoogleAccessToken(refreshToken);
          token.access_token = refreshed.accessToken;
          token.expires_at = refreshed.expiresAt;
          if (refreshed.refreshToken) token.refresh_token = refreshed.refreshToken;
          delete token.error;

          // Persist the fresh token back into the accounts row so the Gmail read
          // path (provisionCorsairTenant / refreshCorsairTokens) reads valid
          // credentials instead of re-provisioning Corsair with a stale token.
          if (userId) {
            await db
              .update(accounts)
              .set({
                access_token: refreshed.accessToken,
                expires_at: refreshed.expiresAt,
                ...(refreshed.refreshToken
                  ? { refresh_token: refreshed.refreshToken }
                  : {}),
              })
              .where(
                and(
                  eq(accounts.userId, userId),
                  eq(accounts.provider, "google"),
                ),
              );
          }
        } catch (err) {
          // Flag the token so the session exposes the error and the UI can
          // prompt a reconnect. Keep the stale token rather than wiping it so a
          // transient network blip doesn't force re-auth if it recovers.
          console.error("[auth] Google access token refresh failed:", err);
          token.error = "RefreshAccessTokenError";
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
        session.error = token.error as "RefreshAccessTokenError" | undefined;
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
