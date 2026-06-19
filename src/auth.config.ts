import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: { strategy: "jwt" as const },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isAdminRoute = nextUrl.pathname.startsWith("/admin");
      if (!isAdminRoute) return true;
      if (!auth?.user) {
        return Response.redirect(new URL("/login", nextUrl));
      }
      if (!auth.user.isStaff) {
        return Response.redirect(new URL("/", nextUrl));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
