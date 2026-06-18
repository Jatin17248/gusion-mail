import "@/styles/globals.css";
import { type Metadata } from "next";
import { Inter } from "next/font/google";
import { TRPCReactProvider } from "@/trpc/react";
import { Toaster } from "sonner";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { systemConfigs, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { SuspendedView } from "@/components/suspended-view";
import { MaintenanceView } from "@/components/maintenance-view";
import { ImpersonationBanner } from "@/components/impersonation-banner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gusion Mail — AI Command Center",
  description: "Keyboard-first Gmail & Calendar command center powered by AI.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  manifest: "/manifest.json",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  let isSuspended = false;
  let isMaintenance = false;
  let isStaff = false;
  let impersonatedEmail = "";
  let showImpersonationBanner = false;

  if (session?.user?.id) {
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (dbUser) {
      const adminEmails = process.env.PRODUCT_ADMIN_EMAILS
        ? process.env.PRODUCT_ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase())
        : [];
      isStaff =
        dbUser.isStaff === true ||
        (dbUser.email && adminEmails.includes(dbUser.email.toLowerCase())) ||
        false;
      isSuspended = !!dbUser.suspendedAt;

      if (isStaff) {
        const nextHeaders = await import("next/headers");
        const cookiesList = await nextHeaders.cookies();
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
      }
    }
  }

  // Check maintenance mode if not staff
  if (!isStaff) {
    const maintenanceConfig = await db.query.systemConfigs.findFirst({
      where: eq(systemConfigs.key, "maintenanceMode"),
    });
    if (maintenanceConfig && JSON.parse(maintenanceConfig.value) === true) {
      isMaintenance = true;
    }
  }

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
