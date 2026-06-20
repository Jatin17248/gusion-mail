import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: { strategy: "jwt" as const },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const { pathname } = nextUrl;
      const isAdminRoute = pathname.startsWith("/admin");
      const isProtectedRoute = pathname.startsWith("/dashboard") || pathname === "/onboarding";

      if (!isAdminRoute && !isProtectedRoute) return true;

      if (!auth?.user) {
        return Response.redirect(new URL("/login", nextUrl));
      }

      if (isAdminRoute && !auth.user.isStaff) {
        return Response.redirect(new URL("/", nextUrl));
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
