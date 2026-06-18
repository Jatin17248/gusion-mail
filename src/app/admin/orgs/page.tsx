"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import {
  Search,
  Building,
  Users,
  Key,
  Webhook,
  Loader2,
  Trash2,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminOrgsPage() {
  const [search, setSearch] = useState("");
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  // tRPC query to list orgs
  const { data: listData, isLoading: isListLoading } =
    api.admin.listOrgs.useQuery({
      search: search || undefined,
      limit,
      offset,
    });

  // tRPC query to get selected org details
  const { data: orgDetails, isLoading: isDetailsLoading } =
    api.admin.getOrgDetails.useQuery(
      { orgId: selectedOrgId ?? "" },
      { enabled: !!selectedOrgId }
    );

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left panel: List */}
      <div className="flex-1 flex flex-col border-r border-zinc-800 overflow-hidden">
        {/* Search */}
        <div className="p-6 border-b border-zinc-800 flex items-center gap-4 bg-[#0C0C0E]/40">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search organization name or ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOffset(0);
              }}
              className="w-full bg-[#121214] border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* List Table */}
        <div className="flex-1 overflow-auto">
          {isListLoading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
          ) : (listData?.organizations.length ?? 0) === 0 ? (
            <div className="text-zinc-500 text-center py-20 text-sm">
              No matching organizations found.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800/80 bg-zinc-900/10 text-xs font-semibold text-zinc-400 uppercase">
                  <th className="p-4">Organization Name</th>
                  <th className="p-4">Tenant ID</th>
                  <th className="p-4 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {listData?.organizations.map((org) => (
                  <tr
                    key={org.id}
                    onClick={() => setSelectedOrgId(org.id)}
                    className={`hover:bg-zinc-800/20 cursor-pointer transition-colors text-sm ${
                      selectedOrgId === org.id ? "bg-indigo-500/5 hover:bg-indigo-500/10" : ""
                    }`}
                  >
                    <td className="p-4 font-semibold text-zinc-200">
                      {org.name}
                    </td>
                    <td className="p-4 font-mono text-xs text-zinc-500">
                      {org.id}
                    </td>
                    <td className="p-4 text-right text-xs text-zinc-500">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination footer */}
        <div className="p-4 border-t border-zinc-800 flex justify-between items-center text-xs text-zinc-500 bg-[#0C0C0E]/20">
          <span>
            Showing {offset + 1} - {Math.min(offset + limit, listData?.total ?? 0)} of{" "}
            {listData?.total ?? 0}
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
              disabled={offset + limit >= (listData?.total ?? 0)}
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

      {/* Right panel: Inspector / Selected Org Details */}
      <div className="w-96 overflow-auto bg-[#0C0C0E]/40 flex flex-col shrink-0">
        {!selectedOrgId ? (
          <div className="flex-1 flex flex-col justify-center items-center p-6 text-center text-zinc-500 text-xs">
            <Building className="w-8 h-8 text-zinc-700 mb-2" />
            <span>Select an organization to audit members, webhook destinations, and developer credentials.</span>
          </div>
        ) : isDetailsLoading ? (
          <div className="flex justify-center items-center py-20 flex-1">
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Header info */}
            <div>
              <h2 className="text-base font-bold text-zinc-100">
                {orgDetails?.org.name}
              </h2>
              <span className="text-zinc-500 text-xs mt-0.5 block font-mono">ID: {orgDetails?.org.id}</span>
            </div>

            {/* Members List */}
            <div className="border border-zinc-800 bg-[#121214]/40 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>Members ({orgDetails?.members.length ?? 0})</span>
              </h3>
              
              <div className="space-y-2">
                {orgDetails?.members.map((m) => (
                  <div key={m.id} className="bg-[#09090B] border border-zinc-850 p-2.5 rounded-lg flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold block text-zinc-300">{m.name}</span>
                      <span className="text-zinc-500 text-[10px] block mt-0.5">{m.email}</span>
                    </div>
                    <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md uppercase border ${
                      m.role === "owner"
                        ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                        : m.role === "admin"
                        ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                        : "bg-zinc-800 text-zinc-400 border-zinc-700"
                    }`}>
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Outbound Webhooks */}
            <div className="border border-zinc-800 bg-[#121214]/40 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Webhook className="w-4 h-4 text-emerald-400" />
                <span>Webhooks ({orgDetails?.webhooks.length ?? 0})</span>
              </h3>
              
              <div className="space-y-2">
                {(orgDetails?.webhooks.length ?? 0) === 0 ? (
                  <span className="text-zinc-500 text-xs block">No webhook destinations configured.</span>
                ) : (
                  orgDetails?.webhooks.map((w) => (
                    <div key={w.id} className="bg-[#09090B] border border-zinc-850 p-2.5 rounded-lg text-xs space-y-1">
                      <span className="font-medium text-zinc-300 block truncate" title={w.url}>
                        {w.url}
                      </span>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md ${
                          w.isActive
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                        }`}>
                          {w.isActive ? "ACTIVE" : "DISABLED"}
                        </span>
                        <span className="text-[9px] text-zinc-500">
                          {w.events}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* API Keys */}
            <div className="border border-zinc-800 bg-[#121214]/40 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Key className="w-4 h-4 text-indigo-400" />
                <span>API Keys ({orgDetails?.apiKeys.length ?? 0})</span>
              </h3>
              
              <div className="space-y-2">
                {(orgDetails?.apiKeys.length ?? 0) === 0 ? (
                  <span className="text-zinc-500 text-xs block">No active developer API credentials.</span>
                ) : (
                  orgDetails?.apiKeys.map((k) => (
                    <div key={k.id} className="bg-[#09090B] border border-zinc-850 p-2.5 rounded-lg text-xs space-y-1">
                      <span className="font-semibold text-zinc-300 block">
                        {k.name}
                      </span>
                      <span className="text-zinc-500 font-mono text-[9px] block">
                        Prefix: {k.keyPrefix}
                      </span>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md ${
                          k.isActive
                            ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                            : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                        }`}>
                          {k.isActive ? "ACTIVE" : "DISABLED"}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {new Date(k.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
