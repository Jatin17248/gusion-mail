"use client";

import { api } from "@/trpc/react";
import { toast } from "sonner";
import {
  Users as UsersIcon,
  Building,
  Calendar,
  AlertTriangle,
  Play,
  Settings,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminDashboardPage() {
  const { data: metrics, isLoading: isMetricsLoading, refetch: refetchMetrics } =
    api.admin.getMetrics.useQuery(undefined, {
      refetchInterval: 15000, // Refresh every 15s
    });

  const { data: configs, isLoading: isConfigsLoading, refetch: refetchConfigs } =
    api.admin.getSystemConfigs.useQuery();

  const updateConfig = api.admin.updateSystemConfig.useMutation({
    onSuccess: () => {
      toast.success("System configuration updated successfully.");
      refetchConfigs();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update configuration.");
    },
  });

  const handleToggleConfig = (key: string, currentValue: boolean) => {
    updateConfig.mutate({
      key,
      value: !currentValue,
    });
  };

  const isLoading = isMetricsLoading || isConfigsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  // Configurations (default to false if not set in DB)
  const isMaintenanceMode = configs?.["maintenanceMode"] === true;
  const isDisableApi = configs?.["disableApi"] === true;
  const isDisableBulkSend = configs?.["disableBulkSend"] === true;

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Operator Dashboard</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Real-time platform metrics and system operation switches.
          </p>
        </div>
        <Button
          onClick={() => {
            refetchMetrics();
            refetchConfigs();
            toast.success("Metrics updated.");
          }}
          variant="outline"
          className="border-zinc-800 hover:bg-zinc-800/40 text-zinc-300 text-xs"
        >
          Refresh Data
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Users */}
        <div className="border border-zinc-800/60 bg-[#0C0C0E]/50 rounded-xl p-6 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">
              Total Signups
            </span>
            <UsersIcon className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight">
              {metrics?.users ?? 0}
            </span>
            <span className="text-zinc-500 text-xs">accounts</span>
          </div>
        </div>

        {/* Total Orgs */}
        <div className="border border-zinc-800/60 bg-[#0C0C0E]/50 rounded-xl p-6 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">
              Organizations
            </span>
            <Building className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight">
              {metrics?.organizations ?? 0}
            </span>
            <span className="text-zinc-500 text-xs">tenants</span>
          </div>
        </div>

        {/* Active Trials */}
        <div className="border border-zinc-800/60 bg-[#0C0C0E]/50 rounded-xl p-6 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">
              Active Trials
            </span>
            <Calendar className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-indigo-400">
              {metrics?.trials ?? 0}
            </span>
            <span className="text-zinc-500 text-xs">within 14d</span>
          </div>
        </div>

        {/* Paying Customers */}
        <div className="border border-zinc-800/60 bg-[#0C0C0E]/50 rounded-xl p-6 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">
              Paid Subscriptions
            </span>
            <Settings className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-emerald-400">
              {(metrics?.subscriptions?.pro ?? 0) + (metrics?.subscriptions?.team ?? 0)}
            </span>
            <span className="text-zinc-500 text-xs">
              (Pro: {metrics?.subscriptions?.pro ?? 0}, Team: {metrics?.subscriptions?.team ?? 0})
            </span>
          </div>
        </div>
      </div>

      {/* Lower Grid: Kill Switches & Queue Health */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Operator Controls / Switches */}
        <div className="border border-zinc-800/60 bg-[#0C0C0E]/50 rounded-xl p-6">
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2 mb-6">
            <ShieldAlert className="w-5 h-5 text-indigo-500" />
            <span>Platform Switches</span>
          </h2>
          
          <div className="space-y-6">
            {/* Maintenance Mode */}
            <div className="flex items-center justify-between border-b border-zinc-800/50 pb-4">
              <div>
                <span className="font-semibold text-sm text-zinc-200 block">
                  Maintenance Mode
                </span>
                <span className="text-zinc-500 text-xs mt-0.5 block max-w-xs">
                  Force maintenance screen on all non-operator users.
                </span>
              </div>
              <button
                onClick={() => handleToggleConfig("maintenanceMode", isMaintenanceMode)}
                disabled={updateConfig.isPending}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                  isMaintenanceMode ? "bg-amber-600" : "bg-zinc-800"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    isMaintenanceMode ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Disable API Keys */}
            <div className="flex items-center justify-between border-b border-zinc-800/50 pb-4">
              <div>
                <span className="font-semibold text-sm text-zinc-200 block">
                  Disable Inbound API
                </span>
                <span className="text-zinc-500 text-xs mt-0.5 block max-w-xs">
                  Instantly block validation of all external developer API keys.
                </span>
              </div>
              <button
                onClick={() => handleToggleConfig("disableApi", isDisableApi)}
                disabled={updateConfig.isPending}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                  isDisableApi ? "bg-red-600" : "bg-zinc-800"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    isDisableApi ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Disable Bulk Send */}
            <div className="flex items-center justify-between pb-2">
              <div>
                <span className="font-semibold text-sm text-zinc-200 block">
                  Pause Bulk Campaigns
                </span>
                <span className="text-zinc-500 text-xs mt-0.5 block max-w-xs">
                  Prevent campaigns from starting and skip campaign processing.
                </span>
              </div>
              <button
                onClick={() => handleToggleConfig("disableBulkSend", isDisableBulkSend)}
                disabled={updateConfig.isPending}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                  isDisableBulkSend ? "bg-red-600" : "bg-zinc-800"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    isDisableBulkSend ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Queue and Job Monitoring */}
        <div className="border border-zinc-800/60 bg-[#0C0C0E]/50 rounded-xl p-6">
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2 mb-6">
            <Play className="w-5 h-5 text-indigo-500" />
            <span>Job Queues & Webhooks Health</span>
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Pending Outbox */}
            <div className="bg-[#121214] border border-zinc-800 rounded-lg p-4">
              <span className="text-zinc-400 text-[11px] uppercase tracking-wider font-semibold block">
                Pending Emails Queue
              </span>
              <span className="text-2xl font-bold block mt-1 text-zinc-200">
                {metrics?.queue?.pending ?? 0}
              </span>
            </div>

            {/* Failed Outbox */}
            <div className="bg-[#121214] border border-zinc-800 rounded-lg p-4">
              <span className="text-zinc-400 text-[11px] uppercase tracking-wider font-semibold block">
                Failed Outbox Queue
              </span>
              <span className={`text-2xl font-bold block mt-1 ${
                (metrics?.queue?.failed ?? 0) > 0 ? "text-red-500" : "text-zinc-200"
              }`}>
                {metrics?.queue?.failed ?? 0}
              </span>
            </div>

            {/* Webhook Failures */}
            <div className="bg-[#121214] border border-zinc-800 rounded-lg p-4">
              <span className="text-zinc-400 text-[11px] uppercase tracking-wider font-semibold block">
                Failed Webhooks (Logs)
              </span>
              <span className={`text-2xl font-bold block mt-1 ${
                (metrics?.queue?.failedWebhooks ?? 0) > 0 ? "text-red-500" : "text-zinc-200"
              }`}>
                {metrics?.queue?.failedWebhooks ?? 0}
              </span>
            </div>

            {/* Failed Automations */}
            <div className="bg-[#121214] border border-zinc-800 rounded-lg p-4">
              <span className="text-zinc-400 text-[11px] uppercase tracking-wider font-semibold block">
                Automation Run Failures
              </span>
              <span className={`text-2xl font-bold block mt-1 ${
                (metrics?.queue?.failedAutomations ?? 0) > 0 ? "text-red-400" : "text-zinc-200"
              }`}>
                {metrics?.queue?.failedAutomations ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
