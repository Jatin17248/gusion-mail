import "@/styles/globals.css";

import { type Metadata } from "next";
import { Inter } from "next/font/google";
import { TRPCReactProvider } from "@/trpc/react";
import { Toaster } from "sonner";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/server/auth";
import type { Session } from "next-auth";
import { db } from "@/server/db";
import { systemConfigs, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { SuspendedView } from "@/components/suspended-view";
import { MaintenanceView } from "@/components/maintenance-view";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { unstable_rethrow } from "next/navigation";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gusion Mail — AI Command Center",
  description: "Keyboard-first Gmail & Calendar command center powered by AI.",
  manifest: "/manifest.json",
};

async function getSafeSession() {
  try {
    return await auth();
  } catch (error) {
    unstable_rethrow(error);
    console.error("[layout] Failed to load session:", error);
    return null;
  }
}

const getMaintenanceMode = unstable_cache(
  async () => {
    try {
      const row = await db.query.systemConfigs.findFirst({
        where: eq(systemConfigs.key, "maintenanceMode"),
      });
      return row ? JSON.parse(row.value) === true : false;
    } catch (error) {
      console.error("[layout] Failed to load maintenance mode:", error);
      return false;
    }
  },
  ["maintenance-mode"],
  { revalidate: 60 }
);

async function getLayoutState(session: Session | null) {
  // isStaff and suspendedAt come from the JWT — no DB query needed.
  const isStaff = session?.user?.isStaff ?? false;
  const isSuspended = !!session?.user?.suspendedAt;
  let isMaintenance = false;
  let showImpersonationBanner = false;
  let impersonatedEmail = "";

  if (isStaff && session?.user?.id) {
    try {
      const cookiesList = await cookies();
      const impId = cookiesList.get("gusion_impersonate_id")?.value;
      if (impId && impId !== session.user.id) {
        const impUser = await db.query.users.findFirst({
          where: eq(users.id, impId),
        });
        if (impUser) {
          showImpersonationBanner = true;
          impersonatedEmail = impUser.email ?? "";
        }
      }
    } catch (error) {
      unstable_rethrow(error);
      console.error("[layout] Failed to load impersonated user:", error);
    }
  } else {
    isMaintenance = await getMaintenanceMode();
  }

  return { isSuspended, isMaintenance, showImpersonationBanner, impersonatedEmail };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSafeSession();
  const {
    isSuspended,
    isMaintenance,
    impersonatedEmail,
    showImpersonationBanner,
  } = await getLayoutState(session);

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.getItem('theme') === 'light') {
                  document.documentElement.classList.remove('dark');
                } else {
                  document.documentElement.classList.add('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className={`${inter.className} antialiased min-h-screen bg-background text-foreground`}>
        <SessionProvider session={session}>
          <TRPCReactProvider>
            {isSuspended ? (
              <SuspendedView />
            ) : isMaintenance ? (
              <MaintenanceView />
            ) : (
              <div className="flex flex-col min-h-screen">
                {showImpersonationBanner && (
                  <ImpersonationBanner email={impersonatedEmail} />
                )}
                <div className="flex-1 flex flex-col">{children}</div>
              </div>
            )}
            <Toaster position="bottom-right" closeButton richColors />
          </TRPCReactProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
