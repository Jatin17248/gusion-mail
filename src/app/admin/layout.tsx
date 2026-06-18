import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { BarChart3, Users, Network, ScrollText, ArrowLeft, Terminal } from "lucide-react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  const adminEmails = process.env.PRODUCT_ADMIN_EMAILS
    ? process.env.PRODUCT_ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase())
    : [];
  const isStaff =
    dbUser?.isStaff === true ||
    (dbUser?.email && adminEmails.includes(dbUser.email.toLowerCase()));

  if (!isStaff) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen bg-[#09090B] text-zinc-100">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 bg-[#0C0C0E] shrink-0 flex flex-col">
        <div className="h-16 px-6 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-indigo-500" />
            <span className="font-bold tracking-tight text-sm text-zinc-100">
              Gusion Operator
            </span>
          </div>
          <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 rounded-md">
            Console
          </span>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <Link
            href="/admin"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/40 transition-all"
          >
            <BarChart3 className="w-4 h-4 text-zinc-500" />
            <span>Dashboard</span>
          </Link>
          <Link
            href="/admin/users"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/40 transition-all"
          >
            <Users className="w-4 h-4 text-zinc-500" />
            <span>Users Directory</span>
          </Link>
          <Link
            href="/admin/orgs"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/40 transition-all"
          >
            <Network className="w-4 h-4 text-zinc-500" />
            <span>Organizations</span>
          </Link>
          <Link
            href="/admin/audit"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/40 transition-all"
          >
            <ScrollText className="w-4 h-4 text-zinc-500" />
            <span>Platform Audit</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Application</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-auto bg-[#09090B]">
        {children}
      </main>
    </div>
  );
}
