"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import {
  Search,
  User as UserIcon,
  Shield,
  Ban,
  Calendar,
  Sparkles,
  Link2,
  AlertTriangle,
  RotateCcw,
  Eye,
  Loader2,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // tRPC query to list users
  const { data: listData, isLoading: isListLoading, refetch: refetchList } =
    api.admin.listUsers.useQuery({
      search: search || undefined,
      limit,
      offset,
    });

  // tRPC query for selected user details
  const { data: userDetails, isLoading: isDetailsLoading, refetch: refetchDetails } =
    api.admin.getUserDetails.useQuery(
      { userId: selectedUserId ?? "" },
      { enabled: !!selectedUserId }
    );

  // Operator Actions
  const toggleStaff = api.admin.toggleUserStaff.useMutation({
    onSuccess: () => {
      toast.success("Staff privilege updated.");
      refetchList();
      refetchDetails();
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleSuspension = api.admin.toggleUserSuspension.useMutation({
    onSuccess: () => {
      toast.success("Suspension status updated.");
      refetchList();
      refetchDetails();
    },
    onError: (err) => toast.error(err.message),
  });

  const resetTrial = api.admin.resetUserTrial.useMutation({
    onSuccess: () => {
      toast.success("14-day trial timer has been reset.");
      refetchList();
      refetchDetails();
    },
    onError: (err) => toast.error(err.message),
  });

  const disconnectGoogle = api.admin.disconnectGmail.useMutation({
    onSuccess: () => {
      toast.success("Google integration revoked.");
      refetchList();
      refetchDetails();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateSub = api.admin.updateUserSubscription.useMutation({
    onSuccess: () => {
      toast.success("Subscription entitlements updated.");
      refetchDetails();
    },
    onError: (err) => toast.error(err.message),
  });

  // Edit Subscription Form states
  const [subPlan, setSubPlan] = useState<"free" | "pro" | "team">("free");
  const [subStatus, setSubStatus] = useState<"active" | "trialing" | "past_due" | "canceled">("active");
  const [subPeriodEnd, setSubPeriodEnd] = useState("");

  const loadSubForm = () => {
    if (userDetails?.subscription) {
      setSubPlan(userDetails.subscription.plan as any);
      setSubStatus(userDetails.subscription.status as any);
      setSubPeriodEnd(
        userDetails.subscription.currentPeriodEnd
          ? new Date(userDetails.subscription.currentPeriodEnd).toISOString().split("T")[0] ?? ""
          : ""
      );
    } else {
      setSubPlan("free");
      setSubStatus("trialing");
      setSubPeriodEnd("");
    }
  };

  const handleImpersonate = (userId: string) => {
    // Set a path-wide cookie for the impersonation target user
    document.cookie = `gusion_impersonate_id=${userId}; path=/; max-age=86400`; // 24 hours
    toast.success("Impersonation cookie set. Switching context...");
    setTimeout(() => {
      window.location.href = "/";
    }, 800);
  };

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
              placeholder="Search user email, name, or ID..."
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
          ) : (listData?.users.length ?? 0) === 0 ? (
            <div className="text-zinc-500 text-center py-20 text-sm">
              No matching users found.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800/80 bg-zinc-900/10 text-xs font-semibold text-zinc-400 uppercase">
                  <th className="p-4">User</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Staff?</th>
                  <th className="p-4">Trial Start</th>
                  <th className="p-4 text-right">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {listData?.users.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => {
                      setSelectedUserId(u.id);
                      // Reset sub form state load
                      setTimeout(loadSubForm, 50);
                    }}
                    className={`hover:bg-zinc-800/20 cursor-pointer transition-colors text-sm ${
                      selectedUserId === u.id ? "bg-indigo-500/5 hover:bg-indigo-500/10" : ""
                    }`}
                  >
                    <td className="p-4">
                      <div className="font-semibold text-zinc-200">
                        {u.name || "No Name"}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">{u.email}</div>
                    </td>
                    <td className="p-4">
                      {u.suspendedAt ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-red-500/10 border border-red-500/25 text-red-500 rounded-md">
                          Suspended
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 rounded-md">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      {u.isStaff ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 rounded-md">
                          Staff
                        </span>
                      ) : (
                        <span className="text-zinc-500 text-xs">—</span>
                      )}
                    </td>
                    <td className="p-4 text-zinc-400 text-xs">
                      {u.trialStartedAt
                        ? new Date(u.trialStartedAt).toLocaleDateString()
                        : "No Trial"}
                    </td>
                    <td className="p-4 text-right text-xs text-zinc-500">
                      {new Date(u.createdAt).toLocaleDateString()}
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

      {/* Right panel: Inspector / Selected user Details */}
      <div className="w-96 overflow-auto bg-[#0C0C0E]/40 flex flex-col shrink-0">
        {!selectedUserId ? (
          <div className="flex-1 flex flex-col justify-center items-center p-6 text-center text-zinc-500 text-xs">
            <UserIcon className="w-8 h-8 text-zinc-700 mb-2" />
            <span>Select a user from the directory to inspect profile data, subscriptions, and actions.</span>
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
                {userDetails?.user.name || "No Name"}
              </h2>
              <span className="text-zinc-500 text-xs mt-0.5 block">{userDetails?.user.email}</span>
              <span className="text-[10px] font-mono text-zinc-600 block mt-1">ID: {userDetails?.user.id}</span>
            </div>

            {/* Impersonate button */}
            <Button
              onClick={() => handleImpersonate(userDetails!.user.id)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 h-10 text-xs font-semibold"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Impersonate User</span>
            </Button>

            {/* Platform Role and Status controls */}
            <div className="border border-zinc-800 bg-[#121214]/40 rounded-xl p-4 space-y-4">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Access & Security Control
              </h3>
              
              <div className="space-y-3">
                {/* Staff Privileges Toggle */}
                <div className="flex items-center justify-between text-xs">
                  <span>Staff / Operator Role</span>
                  <Button
                    onClick={() =>
                      toggleStaff.mutate({
                        userId: userDetails!.user.id,
                        isStaff: !userDetails!.user.isStaff,
                      })
                    }
                    disabled={toggleStaff.isPending}
                    size="sm"
                    variant="outline"
                    className={`border-zinc-800 text-[10px] h-7 px-2.5 ${
                      userDetails?.user.isStaff ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/35 hover:bg-indigo-500/20" : "text-zinc-400 hover:bg-zinc-850"
                    }`}
                  >
                    <Shield className="w-3 h-3 mr-1" />
                    <span>{userDetails?.user.isStaff ? "Staff Role Active" : "Grant Staff Role"}</span>
                  </Button>
                </div>

                {/* Suspension Toggle */}
                <div className="flex items-center justify-between text-xs">
                  <span>Account Status</span>
                  <Button
                    onClick={() =>
                      toggleSuspension.mutate({
                        userId: userDetails!.user.id,
                        suspend: !userDetails!.user.suspendedAt,
                      })
                    }
                    disabled={toggleSuspension.isPending}
                    size="sm"
                    variant="outline"
                    className={`border-zinc-800 text-[10px] h-7 px-2.5 ${
                      userDetails?.user.suspendedAt
                        ? "bg-red-500/10 text-red-400 border-red-500/35 hover:bg-red-500/20"
                        : "text-zinc-400 hover:bg-zinc-850"
                    }`}
                  >
                    <Ban className="w-3 h-3 mr-1" />
                    <span>{userDetails?.user.suspendedAt ? "Suspended" : "Suspend Account"}</span>
                  </Button>
                </div>

                {/* Reset trial */}
                <div className="flex items-center justify-between text-xs border-t border-zinc-850 pt-3">
                  <div className="flex flex-col gap-0.5">
                    <span>Trial Expiry Reset</span>
                    <span className="text-[10px] text-zinc-500">
                      Started: {userDetails?.user.trialStartedAt ? new Date(userDetails.user.trialStartedAt).toLocaleDateString() : "Never"}
                    </span>
                  </div>
                  <Button
                    onClick={() => resetTrial.mutate({ userId: userDetails!.user.id })}
                    disabled={resetTrial.isPending}
                    size="sm"
                    variant="outline"
                    className="border-zinc-800 text-[10px] h-7 px-2.5 text-zinc-400 hover:bg-zinc-850"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    <span>Reset 14d Trial</span>
                  </Button>
                </div>

                {/* Force Disconnect Google */}
                <div className="flex items-center justify-between text-xs border-t border-zinc-850 pt-3">
                  <div className="flex flex-col gap-0.5">
                    <span>Disconnect Google Connection</span>
                    <span className="text-[10px] text-zinc-500">
                      Gmail: {userDetails?.user.gmailConnected ? "Yes" : "No"} | Calendar: {userDetails?.user.calendarConnected ? "Yes" : "No"}
                    </span>
                  </div>
                  <Button
                    onClick={() => disconnectGoogle.mutate({ userId: userDetails!.user.id })}
                    disabled={disconnectGoogle.isPending}
                    size="sm"
                    variant="outline"
                    className="border-zinc-800 text-[10px] h-7 px-2.5 text-red-400 hover:bg-red-950/20 border-red-500/20"
                  >
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    <span>Revoke Connect</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Entitlements / Subscription Override Form */}
            <div className="border border-zinc-800 bg-[#121214]/40 rounded-xl p-4 space-y-4">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Override Subscription Plan</span>
              </h3>

              <div className="space-y-3 text-xs">
                {/* Plan Dropdown */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-zinc-400">Subscription Tier</label>
                  <select
                    value={subPlan}
                    onChange={(e) => setSubPlan(e.target.value as any)}
                    className="w-full bg-[#121214] border border-zinc-800 rounded-lg p-2 text-zinc-200 text-xs focus:outline-none"
                  >
                    <option value="free">Free Tier</option>
                    <option value="pro">Pro Plan</option>
                    <option value="team">Team Edition</option>
                  </select>
                </div>

                {/* Status Dropdown */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-zinc-400">Payment/Subscription Status</label>
                  <select
                    value={subStatus}
                    onChange={(e) => setSubStatus(e.target.value as any)}
                    className="w-full bg-[#121214] border border-zinc-800 rounded-lg p-2 text-zinc-200 text-xs focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="trialing">Trialing</option>
                    <option value="past_due">Past Due</option>
                    <option value="canceled">Canceled</option>
                  </select>
                </div>

                {/* Period End Date */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-zinc-400">Expiration / Period End Date</label>
                  <input
                    type="date"
                    value={subPeriodEnd}
                    onChange={(e) => setSubPeriodEnd(e.target.value)}
                    className="w-full bg-[#121214] border border-zinc-800 rounded-lg p-2 text-zinc-200 text-xs focus:outline-none"
                  />
                </div>

                <Button
                  onClick={() =>
                    updateSub.mutate({
                      userId: userDetails!.user.id,
                      plan: subPlan,
                      status: subStatus,
                      currentPeriodEnd: subPeriodEnd ? new Date(subPeriodEnd).toISOString() : null,
                    })
                  }
                  disabled={updateSub.isPending}
                  size="sm"
                  className="w-full bg-indigo-600/10 hover:bg-indigo-600/25 border border-indigo-500/25 text-indigo-400 h-9 font-semibold text-[11px]"
                >
                  Save Override Settings
                </Button>
              </div>
            </div>

            {/* Connected Accounts details */}
            <div className="border border-zinc-800 bg-[#121214]/40 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                <Link2 className="w-3.5 h-3.5 text-zinc-500" />
                <span>Connected Social Logins</span>
              </h3>
              
              <div className="space-y-2">
                {userDetails?.connectedAccounts.length === 0 ? (
                  <span className="text-zinc-500 text-xs">No connected accounts.</span>
                ) : (
                  userDetails?.connectedAccounts.map((acc) => (
                    <div key={acc.id} className="bg-[#09090B] border border-zinc-850 p-2.5 rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold block text-zinc-300">
                          {acc.provider.toUpperCase()}
                        </span>
                        <span className="text-zinc-500 text-[10px] mt-0.5 block">{acc.email}</span>
                      </div>
                      {acc.isDefault && (
                        <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-md">
                          Default
                        </span>
                      )}
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
