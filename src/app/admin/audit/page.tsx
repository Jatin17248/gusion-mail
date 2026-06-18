"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { Loader2, ScrollText, Calendar, ShieldCheck, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminAuditPage() {
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);

  // tRPC query to list global audit logs
  const { data: auditData, isLoading, refetch } = api.admin.getAuditLogs.useQuery({
    limit,
    offset,
  });

  return (
    <div className="p-8 space-y-8 flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Audit Logs</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Chonological history of all operator actions executed across the Gusion platform.
          </p>
        </div>
        <Button
          onClick={() => {
            refetch();
          }}
          variant="outline"
          className="border-zinc-800 hover:bg-zinc-800/40 text-zinc-300 text-xs"
        >
          Refresh Feed
        </Button>
      </div>

      {/* Main Audit Grid */}
      <div className="flex-1 border border-zinc-800 bg-[#0C0C0E]/30 rounded-xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          ) : (auditData?.logs.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500 text-sm">
              <ScrollText className="w-8 h-8 text-zinc-700 mb-2" />
              <span>No audit logs recorded yet.</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/10 text-xs font-semibold text-zinc-400 uppercase">
                  <th className="p-4 w-48">Timestamp</th>
                  <th className="p-4 w-64">Operator</th>
                  <th className="p-4 w-56">Action</th>
                  <th className="p-4">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 text-sm">
                {auditData?.logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-850/10 transition-colors">
                    <td className="p-4 text-xs font-mono text-zinc-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-zinc-200 font-medium">
                        <Mail className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{log.userEmail}</span>
                      </div>
                      <span className="text-[10px] text-zinc-600 block mt-0.5 font-mono">
                        ID: {log.userId}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 text-[11px] font-mono font-semibold bg-zinc-800 border border-zinc-700/60 text-zinc-300 rounded-md">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4">
                      <pre className="text-[11px] font-mono text-indigo-400 bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-850 max-w-xl overflow-x-auto whitespace-pre-wrap leading-relaxed">
                        {log.metadata}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 flex justify-between items-center text-xs text-zinc-500 bg-[#0C0C0E]/20 shrink-0">
          <span>
            Showing {offset + 1} - {Math.min(offset + limit, auditData?.total ?? 0)} of{" "}
            {auditData?.total ?? 0}
          </span>
          <div className="flex gap-2">
            <Button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              variant="outline"
              size="sm"
              className="border-zinc-800 text-zinc-400 text-[11px] h-8"
            >
              Prev
            </Button>
            <Button
              disabled={offset + limit >= (auditData?.total ?? 0)}
              onClick={() => setOffset(offset + limit)}
              variant="outline"
              size="sm"
              className="border-zinc-800 text-zinc-400 text-[11px] h-8"
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
