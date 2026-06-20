"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  Plus,
  Sparkles,
  Settings,
  Copy,
  Download,
  ExternalLink,
  Lock,
  Trash2,
} from "lucide-react";
import { AutomationsSettingsView } from "@/app/_components/automations-settings";
import { DeveloperSettingsView } from "@/app/_components/developer-settings";
import { SuppressionListSettingsView } from "@/app/_components/suppression-settings";
import { TemplatesSettingsView } from "@/app/_components/templates-settings";
import { SubscriptionManager } from "@/app/_components/subscription-manager";
import { ConnectedAccountsSettings } from "@/app/_components/connected-accounts-settings";

export function formatMessageDate(dateStr: string | null) {
  if (!dateStr) return "";
  // internalDate from Gmail is a ms-since-epoch string (e.g. "1718739600000")
  const ms = Number(dateStr);
  const date = isNaN(ms) ? new Date(dateStr) : new Date(ms);
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  return isToday
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function parseEmailAddress(headerValue: string) {
  const match = /^(.*)<(.*)>$/.exec(headerValue.trim());
  if (match) {
    return { name: match[1]!.replace(/"/g, "").trim(), email: match[2]!.trim() };
  }
  return { name: "", email: headerValue.trim() };
}

export function formatSender(headerValue: string) {
  const { name, email } = parseEmailAddress(headerValue);
  return name || email.split("@")[0] || headerValue;
}

export function SettingsView() {
  const { data: session } = useSession();
  const utils = api.useUtils();
  const [settingsSubTab, setSettingsSubTab] = useState<"general" | "templates" | "automations" | "developer" | "suppression" | "billing" | "accounts">("general");
  const [inviteEmail, setInviteEmail] = useState("");
  const [referralCodeInput, setReferralCodeInput] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [exporting, setExporting] = useState(false);

  // Scheduling states
  const [linkTitle, setLinkTitle] = useState("");
  const [linkSlug, setLinkSlug] = useState("");
  const [linkDuration, setLinkDuration] = useState(30);
  const [linkBuffer, setLinkBuffer] = useState(0);

  // VIP Contacts states
  const [vipSearch, setVipSearch] = useState("");
  const [newVipEmail, setNewVipEmail] = useState("");
  const [newVipName, setNewVipName] = useState("");

  // Org states
  const [orgInviteEmail, setOrgInviteEmail] = useState("");
  const [orgInviteRole, setOrgInviteRole] = useState<"admin" | "member">("member");
  const [newOrgName, setNewOrgName] = useState("");

  // Queries
  const { data: sub } = api.billing.getSubscription.useQuery();
  const { data: refStats, refetch: refetchRefStats } = api.referral.getReferralStats.useQuery();
  const { data: userProfile } = api.auth.me.useQuery();
  const { data: links, refetch: refetchLinks } = api.scheduling.listLinks.useQuery();
  const { data: contactsData, refetch: refetchContacts } = api.contacts.listContacts.useQuery({
    searchQuery: vipSearch,
  });
  const { data: activeOrg, refetch: refetchOrg } = api.org.getOrg.useQuery();
  const { data: orgMembersList, refetch: refetchMembers } = api.org.listMembers.useQuery();

  // Prefill referral code if present in localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && !refStats?.referredByCode) {
      const stored = localStorage.getItem("gusion_referral_code");
      if (stored) {
        setReferralCodeInput(stored);
      }
    }
  }, [refStats]);

  // Mutations
  const createLink = api.scheduling.createLink.useMutation({
    onSuccess: () => {
      toast.success("Scheduling link created!");
      setLinkTitle("");
      setLinkSlug("");
      setLinkDuration(30);
      setLinkBuffer(0);
      void refetchLinks();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create scheduling link.");
    },
  });

  const toggleLink = api.scheduling.toggleLink.useMutation({
    onSuccess: () => {
      toast.success("Link status updated!");
      void refetchLinks();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update link status.");
    },
  });

  const addVipContact = api.contacts.addContact.useMutation({
    onSuccess: () => {
      toast.success("VIP contact added!");
      setNewVipEmail("");
      setNewVipName("");
      void refetchContacts();
      void utils.gmail.searchEmails.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to add VIP contact.");
    },
  });

  const toggleVipContact = api.contacts.toggleVip.useMutation({
    onSuccess: () => {
      toast.success("VIP status updated!");
      void refetchContacts();
      void utils.gmail.searchEmails.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to toggle VIP status.");
    },
  });

  const inviteOrgMember = api.org.inviteMember.useMutation({
    onSuccess: () => {
      toast.success("Member invited successfully!");
      setOrgInviteEmail("");
      void refetchMembers();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to invite member.");
    },
  });

  const updateMemberRole = api.org.updateMemberRole.useMutation({
    onSuccess: () => {
      toast.success("Member role updated!");
      void refetchMembers();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update member role.");
    },
  });

  const removeOrgMember = api.org.removeMember.useMutation({
    onSuccess: () => {
      toast.success("Member removed from team!");
      void refetchMembers();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to remove member.");
    },
  });

  const updateOrgName = api.org.updateOrgName.useMutation({
    onSuccess: () => {
      toast.success("Organization name updated!");
      void refetchOrg();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update organization name.");
    },
  });

  const handleCreateLink = () => {
    createLink.mutate({
      title: linkTitle,
      slug: linkSlug,
      durationMins: linkDuration,
      bufferMins: linkBuffer,
    });
  };

  const updateSettings = api.auth.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Settings updated successfully!");
      void utils.auth.me.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update settings.");
    },
  });

  const submitInvite = api.referral.submitReferral.useMutation({
    onSuccess: () => {
      toast.success("Invitation sent successfully!");
      setInviteEmail("");
      void refetchRefStats();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to send invitation.");
    },
  });

  const applyCode = api.referral.applyReferralCode.useMutation({
    onSuccess: () => {
      toast.success("Referral code applied! 30 days added to your trial.");
      setReferralCodeInput("");
      void refetchRefStats();
      void utils.billing.getSubscription.invalidate();
      void utils.auth.me.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to apply referral code.");
    },
  });

  const checkoutSession = api.billing.createCheckoutSession.useMutation({
    onSuccess: (res) => {
      if (res.url) window.location.href = res.url;
    },
    onError: (err) => {
      toast.error(err.message || "Failed to initiate checkout.");
    },
  });

  const portalSession = api.billing.createPortalSession.useMutation({
    onSuccess: (res) => {
      if (res.url) window.location.href = res.url;
    },
    onError: (err) => {
      toast.error(err.message || "Failed to open billing portal.");
    },
  });

  const deleteAccount = api.auth.deleteAccount.useMutation({
    onSuccess: () => {
      toast.success("Account deleted successfully.");
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete account.");
    },
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await utils.auth.exportData.fetch();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gusion-mail-export-${session?.user?.id ?? "data"}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Data exported successfully!");
    } catch {
      toast.error("Failed to export data.");
    } finally {
      setExporting(false);
    }
  };

  const handleCopyCode = () => {
    if (refStats?.referralCode) {
      void navigator.clipboard.writeText(refStats.referralCode);
      toast.success("Referral code copied to clipboard!");
    }
  };

  const handleCopyLink = () => {
    if (refStats?.referralCode) {
      const link = `${window.location.origin}/?ref=${refStats.referralCode}`;
      void navigator.clipboard.writeText(link);
      toast.success("Referral link copied to clipboard!");
    }
  };

  const isSubscribed = sub?.plan && sub.plan !== "free" && sub.status === "active";

  return (
    <section className="flex-1 flex flex-col bg-zinc-950 overflow-y-auto p-6 md:p-8 space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Settings & Account Control</h2>
        <p className="text-zinc-500 text-xs">Manage subscriptions, referrals, security compliance, and privacy controls.</p>
      </div>

      {/* Sub tabs */}
      <div className="flex border-b border-zinc-900 gap-6 text-sm font-medium">
        <button
          onClick={() => setSettingsSubTab("general")}
          className={`pb-3 border-b-2 transition cursor-pointer ${
            settingsSubTab === "general"
              ? "border-indigo-500 text-indigo-400 font-bold"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          General Settings
        </button>
        <button
          onClick={() => setSettingsSubTab("templates")}
          className={`pb-3 border-b-2 transition cursor-pointer ${
            settingsSubTab === "templates"
              ? "border-indigo-500 text-indigo-400 font-bold"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Templates
        </button>
        <button
          onClick={() => setSettingsSubTab("automations")}
          className={`pb-3 border-b-2 transition cursor-pointer ${
            settingsSubTab === "automations"
              ? "border-indigo-500 text-indigo-400 font-bold"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Rules & Automations
        </button>
        <button
          onClick={() => setSettingsSubTab("developer")}
          className={`pb-3 border-b-2 transition cursor-pointer ${
            settingsSubTab === "developer"
              ? "border-indigo-500 text-indigo-400 font-bold"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Developer API & Webhooks
        </button>
        <button
          onClick={() => setSettingsSubTab("suppression")}
          className={`pb-3 border-b-2 transition cursor-pointer ${
            settingsSubTab === "suppression"
              ? "border-indigo-500 text-indigo-400 font-bold"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Suppression List
        </button>
        <button
          onClick={() => setSettingsSubTab("billing")}
          className={`pb-3 border-b-2 transition cursor-pointer ${
            settingsSubTab === "billing"
              ? "border-indigo-500 text-indigo-400 font-bold"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Billing
        </button>
        <button
          onClick={() => setSettingsSubTab("accounts")}
          className={`pb-3 border-b-2 transition cursor-pointer ${
            settingsSubTab === "accounts"
              ? "border-indigo-500 text-indigo-400 font-bold"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Accounts
        </button>
      </div>

      {settingsSubTab === "billing" && (
        <div className="max-w-3xl">
          <SubscriptionManager />
        </div>
      )}

      {settingsSubTab === "accounts" && (
        <div className="max-w-3xl">
          <ConnectedAccountsSettings />
        </div>
      )}

      {settingsSubTab === "general" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        {/* Left column: Growth & Referrals */}
        <div className="space-y-8">
          <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
            <h3 className="text-md font-bold text-zinc-200 mb-2 flex flex-row items-center gap-2">
              <Sparkles size={16} className="text-indigo-400" />
              Refer & Earn Extensions
            </h3>
            <p className="text-zinc-400 text-xs mb-6 leading-relaxed">
              Invite friends to try Gusion Mail. When they sign up, both of you will receive an extra <span className="text-indigo-400 font-semibold">30 days</span> on your free trial!
            </p>

            {/* Referral code display */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-xl border border-zinc-850 bg-zinc-950/40 flex flex-col justify-between">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Your Code</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-mono text-sm font-bold text-white tracking-wider">{refStats?.referralCode ?? "..."}</span>
                  <button
                    onClick={handleCopyCode}
                    className="p-1 hover:bg-zinc-900 rounded text-zinc-400 hover:text-white transition cursor-pointer"
                    title="Copy Code"
                  >
                    <Copy size={13} />
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-zinc-850 bg-zinc-950/40 flex flex-col justify-between">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Share Link</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-zinc-400 truncate max-w-20">gusion-mail.com/?ref=...</span>
                  <button
                    onClick={handleCopyLink}
                    className="p-1 hover:bg-zinc-900 rounded text-zinc-400 hover:text-white transition cursor-pointer"
                    title="Copy Link"
                  >
                    <Copy size={13} />
                  </button>
                </div>
              </div>
            </div>

            {/* Input to send invite */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Invite a Friend by Email</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="friend@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-855 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => submitInvite.mutate({ email: inviteEmail })}
                    disabled={!inviteEmail || submitInvite.isPending}
                    className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-50 cursor-pointer"
                  >
                    Send Invite
                  </button>
                </div>
              </div>

              {/* Input to apply a referral code */}
              {!refStats?.referredByCode ? (
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Were you referred? Enter Code</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="ENTER-FRIENDS-CODE"
                      value={referralCodeInput}
                      onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())}
                      className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-855 rounded-lg text-sm text-zinc-200 font-mono tracking-wider focus:outline-none focus:border-indigo-500 transition focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      onClick={() => applyCode.mutate({ code: referralCodeInput })}
                      disabled={!referralCodeInput || applyCode.isPending}
                      className="px-4 py-2 text-xs font-semibold bg-zinc-900 hover:bg-zinc-855 border border-zinc-800 text-zinc-200 rounded-lg transition disabled:opacity-50 cursor-pointer"
                    >
                      Apply Code
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-emerald-500/10 bg-emerald-500/5 text-emerald-400/90 text-xs font-medium">
                  ✓ Referral code applied: you were referred by <span className="font-mono font-bold">{refStats.referredByCode}</span>
                </div>
              )}
            </div>

            {/* List of Sent Invites */}
            <div>
              <h4 className="text-xs font-semibold text-zinc-400 mb-2">Your Sent Invites</h4>
              {!refStats?.invites || refStats.invites.length === 0 ? (
                <p className="text-[11px] text-zinc-500 italic">No invites sent yet.</p>
              ) : (
                <div className="max-h-37.5 overflow-y-auto border border-zinc-855 rounded-lg divide-y divide-zinc-900">
                  {refStats.invites.map((invite) => (
                    <div key={invite.id} className="p-2.5 flex items-center justify-between text-xs bg-zinc-950/20">
                      <span className="text-zinc-300 font-medium truncate max-w-45">{invite.referredEmail}</span>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          invite.status === "rewarded"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-zinc-800 text-zinc-400"
                        }`}>
                          {invite.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Scheduling Links Card */}
          <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
            <h3 className="text-md font-bold text-zinc-200 mb-2 flex flex-row items-center gap-2">
              <CalendarIcon size={16} className="text-indigo-400" />
              Scheduling & Booking Links
            </h3>
            <p className="text-zinc-400 text-xs mb-6 leading-relaxed">
              Create and share booking links so contacts can schedule meetings directly over your calendar slots.
            </p>

            {/* Link Creation Form */}
            <div className="p-4 rounded-xl border border-zinc-850 bg-zinc-950/40 space-y-4 mb-6 text-left">
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Create New Link</span>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <div>
                  <label className="block text-[10px] text-zinc-500 font-semibold mb-1">Title</label>
                  <input
                    type="text"
                    placeholder="e.g. 30 Min Sync"
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-855 rounded-lg text-xs text-zinc-205 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 font-semibold mb-1">Slug</label>
                  <input
                    type="text"
                    placeholder="e.g. 30min"
                    value={linkSlug}
                    onChange={(e) => setLinkSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-855 rounded-lg text-xs text-zinc-205 font-mono placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-zinc-500 font-semibold mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    min={5}
                    value={linkDuration}
                    onChange={(e) => setLinkDuration(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-855 rounded-lg text-xs text-zinc-205 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 font-semibold mb-1">Buffer (Mins)</label>
                  <input
                    type="number"
                    min={0}
                    value={linkBuffer}
                    onChange={(e) => setLinkBuffer(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-855 rounded-lg text-xs text-zinc-205 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>
              <button
                onClick={handleCreateLink}
                disabled={!linkTitle || !linkSlug || createLink.isPending}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
              >
                {createLink.isPending ? "Creating..." : "Create Booking Link"}
              </button>
            </div>

            {/* List of links */}
            <div>
              <h4 className="text-xs font-semibold text-zinc-400 mb-2">Your Active Links</h4>
              {!links || links.length === 0 ? (
                <p className="text-[11px] text-zinc-500 italic text-left">No scheduling links configured.</p>
              ) : (
                <div className="space-y-2 max-h-55 overflow-y-auto">
                  {links.map((link) => (
                    <div key={link.id} className="p-3 rounded-lg border border-zinc-855 bg-zinc-950/40 flex items-center justify-between gap-4">
                      <div className="min-w-0 text-left">
                        <div className="text-xs font-bold text-zinc-250 truncate">{link.title}</div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate select-all">
                          {`${typeof window !== "undefined" ? window.location.origin : ""}/book/${link.slug}`}
                        </div>
                        <div className="text-[9px] text-zinc-400 mt-1">
                          {link.durationMins}m duration · {link.bufferMins}m buffer
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => toggleLink.mutate({ id: link.id, isActive: !link.isActive })}
                          className={`px-2 py-1 text-[10px] font-semibold rounded transition cursor-pointer ${
                            link.isActive
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {link.isActive ? "Active" : "Paused"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* VIP Contacts Card */}
          <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-md relative overflow-hidden mt-8">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
            <h3 className="text-md font-bold text-zinc-200 mb-2 flex flex-row items-center gap-2">
              <Sparkles size={16} className="text-amber-400" />
              VIP Senders & Contacts
            </h3>
            <p className="text-zinc-400 text-xs mb-6 leading-relaxed">
              Mark key clients, stakeholders, or users as VIPs to highlight their emails in the VIP inbox tab.
            </p>

            {/* VIP Search / Add Form */}
            <div className="p-4 rounded-xl border border-zinc-850 bg-zinc-950/40 space-y-4 mb-6 text-left">
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Add VIP Contact</span>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <div>
                  <label className="block text-[10px] text-zinc-500 font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="partner@company.com"
                    value={newVipEmail}
                    onChange={(e) => setNewVipEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-855 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 font-semibold mb-1">Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={newVipName}
                    onChange={(e) => setNewVipName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-855 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition"
                  />
                </div>
              </div>
              <button
                onClick={() => addVipContact.mutate({ email: newVipEmail, name: newVipName, isVip: true })}
                disabled={!newVipEmail || addVipContact.isPending}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
              >
                {addVipContact.isPending ? "Adding..." : "Add VIP Contact"}
              </button>
            </div>

            {/* List and search */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-semibold text-zinc-400">Manage VIPs</h4>
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={vipSearch}
                  onChange={(e) => setVipSearch(e.target.value)}
                  className="px-2 py-1 bg-zinc-950 border border-zinc-855 rounded text-[11px] text-zinc-300 placeholder:text-zinc-650 focus:outline-none focus:border-amber-500 transition w-32"
                />
              </div>

              {!contactsData || contactsData.length === 0 ? (
                <p className="text-[11px] text-zinc-500 italic text-left">No contacts found.</p>
              ) : (
                <div className="space-y-2 max-h-55 overflow-y-auto">
                  {contactsData.map((contact) => (
                    <div key={contact.id} className="p-3 rounded-lg border border-zinc-855 bg-zinc-950/40 flex items-center justify-between gap-4">
                      <div className="min-w-0 text-left">
                        <div className="text-xs font-bold text-zinc-200 truncate">{contact.name ?? contact.email}</div>
                        {contact.name && (
                          <div className="text-[10px] text-zinc-550 truncate mt-0.5">{contact.email}</div>
                        )}
                        <div className="text-[9px] text-zinc-450 mt-1">
                          {contact.interactionCount} interactions
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => toggleVipContact.mutate({ email: contact.email, isVip: !contact.isVip })}
                          className={`px-2 py-1 text-[10px] font-semibold rounded transition cursor-pointer ${
                            contact.isVip
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/25"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {contact.isVip ? "VIP" : "Regular"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Subscription & Data Policy */}
        <div className="space-y-8">
          {/* Organization & Team Settings Card */}
          <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
            <h3 className="text-md font-bold text-zinc-200 mb-2 flex flex-row items-center gap-2">
              <Plus size={16} className="text-indigo-400" />
              Organization & Team Settings
            </h3>
            <p className="text-zinc-400 text-xs mb-6 leading-relaxed">
              Manage your company or workspace organization settings and invite team members to collaborate.
            </p>

            {/* Active Org Name Form */}
            {activeOrg && (
              <div className="p-4 rounded-xl border border-zinc-850 bg-zinc-950/40 mb-6 text-left space-y-3">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Workspace Name</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Workspace Name"
                    defaultValue={activeOrg.name}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 bg-zinc-950 border border-zinc-855 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 transition"
                  />
                  {(activeOrg.role === "owner" || activeOrg.role === "admin") && (
                    <button
                      onClick={() => updateOrgName.mutate({ name: newOrgName || activeOrg.name })}
                      disabled={updateOrgName.isPending}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                      Save
                    </button>
                  )}
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">
                  Your Role: <span className="font-semibold text-zinc-350 capitalize">{activeOrg.role}</span>
                </div>
              </div>
            )}

            {/* Team Members List */}
            <div className="space-y-4 mb-6">
              <h4 className="text-xs font-semibold text-zinc-400 text-left">Team Members</h4>
              {!orgMembersList || orgMembersList.length === 0 ? (
                <p className="text-[11px] text-zinc-500 italic text-left">No team members found.</p>
              ) : (
                <div className="space-y-2 max-h-55 overflow-y-auto">
                  {orgMembersList.map((member) => (
                    <div key={member.id} className="p-3 rounded-lg border border-zinc-855 bg-zinc-950/40 flex items-center justify-between gap-4">
                      <div className="min-w-0 text-left">
                        <div className="text-xs font-bold text-zinc-200 truncate">{member.name || member.email}</div>
                        <div className="text-[10px] text-zinc-550 truncate mt-0.5">{member.email}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {member.role === "owner" ? (
                          <span className="px-2 py-0.5 text-[9px] bg-zinc-800 text-zinc-400 border border-zinc-700 rounded capitalize font-medium">
                            Owner
                          </span>
                        ) : (activeOrg?.role === "owner" || activeOrg?.role === "admin") ? (
                          <div className="flex items-center gap-1.5">
                            <select
                              value={member.role}
                              onChange={(e) => updateMemberRole.mutate({ memberId: member.id, role: e.target.value as "admin" | "member" })}
                              className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 focus:outline-none"
                            >
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                            </select>
                            <button
                              onClick={() => removeOrgMember.mutate({ memberId: member.id })}
                              className="text-rose-400 hover:text-rose-300 p-0.5 transition cursor-pointer"
                              title="Remove member"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 text-[9px] bg-zinc-900 text-zinc-400 rounded capitalize font-medium">
                            {member.role}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Invite New Team Member Form */}
            {(activeOrg?.role === "owner" || activeOrg?.role === "admin") && (
              <div className="p-4 rounded-xl border border-zinc-855 bg-zinc-950/40 space-y-4 text-left">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Invite Member</span>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  <div className="col-span-2">
                    <label className="block text-[10px] text-zinc-500 font-semibold mb-1">Email</label>
                    <input
                      type="email"
                      placeholder="colleague@company.com"
                      value={orgInviteEmail}
                      onChange={(e) => setOrgInviteEmail(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-855 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-550 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 font-semibold mb-1">Role</label>
                    <select
                      value={orgInviteRole}
                      onChange={(e) => setOrgInviteRole(e.target.value as "admin" | "member")}
                      className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-855 rounded-lg text-xs text-zinc-300 focus:outline-none"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={() => inviteOrgMember.mutate({ email: orgInviteEmail, role: orgInviteRole })}
                  disabled={!orgInviteEmail || inviteOrgMember.isPending}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
                >
                  {inviteOrgMember.isPending ? "Sending..." : "Send Invite"}
                </button>
              </div>
            )}
          </div>

          {/* Subscription Card */}
          <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-md">
            <h3 className="text-md font-bold text-zinc-200 mb-2 flex flex-row items-center gap-2">
              <Settings size={16} className="text-zinc-400" />
              Subscription & Plan
            </h3>
            <p className="text-zinc-400 text-xs mb-6">
              You are currently on the <span className="text-white font-semibold capitalize">{sub?.plan ?? "free"}</span> plan.
            </p>

            <div className="p-4 rounded-xl border border-zinc-855 bg-zinc-950/40 space-y-4 mb-6">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500 font-medium">Trial Period Status</span>
                <span className="text-zinc-300 font-semibold">
                  {sub?.trialDaysRemaining ?? 14} days remaining
                </span>
              </div>
              <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-indigo-600 h-1.5 rounded-full animate-pulse"
                  style={{ width: `${Math.min(100, Math.max(0, ((sub?.trialDaysRemaining ?? 14) / 14) * 100))}%` }}
                />
              </div>
            </div>

            {isSubscribed ? (
              <button
                onClick={() => portalSession.mutate()}
                disabled={portalSession.isPending}
                className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-855 border border-zinc-800 text-zinc-200 font-medium rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
              >
                {portalSession.isPending ? "Loading..." : "Manage Billing Portal"}
              </button>
            ) : (
              <button
                onClick={() => checkoutSession.mutate()}
                disabled={checkoutSession.isPending}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
              >
                {checkoutSession.isPending ? "Processing..." : "Upgrade to Premium ($20/mo)"}
              </button>
            )}
          </div>

            {/* Privacy & Compliance Card */}
          <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-md space-y-6">
            <h3 className="text-md font-bold text-zinc-200 flex flex-row items-center gap-2">
              <Lock size={16} className="text-rose-400" />
              Security & Privacy Compliance
            </h3>

            {/* Viral Signature Toggle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-zinc-300">Viral Email Signature</h4>
                  <p className="text-zinc-500 text-[11px] leading-relaxed max-w-[85%] mt-1">
                    Automatically append a sleek brand signature to outgoing emails to earn referral credits when friends sign up.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !(userProfile?.viralSignatureEnabled ?? true);
                    updateSettings.mutate({ viralSignatureEnabled: nextVal });
                  }}
                  disabled={updateSettings.isPending}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                    (userProfile?.viralSignatureEnabled ?? true) ? "bg-indigo-600" : "bg-zinc-800"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      (userProfile?.viralSignatureEnabled ?? true) ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              <div className="p-3 rounded-lg border border-zinc-855 bg-zinc-950/40 font-mono text-[10px] text-zinc-400 select-none">
                <span className="text-zinc-500">Preview:</span>
                <div className="mt-1 whitespace-pre">
                  {"--\nSent with Gusion Mail - https://mail.gusion.in"}
                </div>
              </div>
            </div>

            {/* Export data */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-zinc-300">Export Personal Data</h4>
              <p className="text-zinc-500 text-[11px] leading-relaxed">
                Download a complete payload of all your stored data, templates, bookings, scheduling links, and email metadata.
              </p>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-1 px-4 py-2 border border-zinc-855 hover:bg-zinc-900 text-zinc-300 rounded-lg text-xs transition font-semibold cursor-pointer disabled:opacity-50"
              >
                <Download size={13} />
                <span>{exporting ? "Compiling export..." : "Export Data (JSON)"}</span>
              </button>
            </div>

            {/* Delete Account */}
            <div className="space-y-2 border-t border-zinc-900 pt-6">
              <h4 className="text-xs font-semibold text-rose-400">Permanently Delete Account</h4>
              <p className="text-zinc-500 text-[11px] leading-relaxed">
                Permanently purge your account, revoke Google scopes, and wipe your data from the sandbox. This action is irreversible.
              </p>
              <button
                onClick={() => setDeleteConfirmOpen(true)}
                className="flex items-center gap-1 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Delete Account</span>
              </button>
            </div>

            {/* Legal Links */}
            <div className="border-t border-zinc-900 pt-6 flex gap-4 text-xs font-medium text-zinc-500">
              <a
                href="/privacy"
                target="_blank"
                rel="noreferrer"
                className="hover:text-zinc-300 flex items-center gap-1 transition"
              >
                <span>Privacy Policy</span>
                <ExternalLink size={10} />
              </a>
              <a
                href="/terms"
                target="_blank"
                rel="noreferrer"
                className="hover:text-zinc-300 flex items-center gap-1 transition"
              >
                <span>Terms of Service</span>
                <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>
      </div>
      )}

      {settingsSubTab === "templates" && <TemplatesSettingsView />}
      {settingsSubTab === "automations" && <AutomationsSettingsView />}
      {settingsSubTab === "developer" && <DeveloperSettingsView />}
      {settingsSubTab === "suppression" && <SuppressionListSettingsView />}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl border border-zinc-900 bg-zinc-900 shadow-2xl relative space-y-4">
            <h3 className="text-md font-bold text-rose-400">Permanently Delete Account?</h3>
            <p className="text-zinc-400 text-xs leading-relaxed">
              This will completely wipe your local mail sync cache, delete calendar references, and revoke all Google credentials.
            </p>
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                Type &quot;delete my account permanently&quot; to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-855 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-rose-500 transition"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setDeleteConfirmText("");
                }}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteAccount.mutate();
                }}
                disabled={deleteConfirmText !== "delete my account permanently" || deleteAccount.isPending}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteAccount.isPending ? "Purging..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function LoaderIcon() {
  return <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />;
}
