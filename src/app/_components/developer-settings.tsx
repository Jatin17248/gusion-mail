import { useState } from "react";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { Lock, Plus, Trash2, Copy, Eye, EyeOff, Terminal, Shield, Check, Activity } from "lucide-react";

export function DeveloperSettingsView() {
  const utils = api.useUtils();
  const { data: keysList, refetch: refetchKeys } = api.apikeys.listKeys.useQuery();
  const { data: webhooksList, refetch: refetchWebhooks } = api.apikeys.listWebhookSubscriptions.useQuery();

  const [keyName, setKeyName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["*"]);
  const [generatedKeyText, setGeneratedKeyText] = useState<string | null>(null);

  const [webhookUrl, setWebhookUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["email.received"]);
  const [selectedWebhookIdForLogs, setSelectedWebhookIdForLogs] = useState<string | null>(null);

  // Queries
  const { data: deliveryLogs } = api.apikeys.listWebhookLogs.useQuery(
    { webhookId: selectedWebhookIdForLogs ?? "" },
    { enabled: !!selectedWebhookIdForLogs }
  );

  // Mutations
  const createKey = api.apikeys.createKey.useMutation({
    onSuccess: (res) => {
      toast.success("API key generated successfully!");
      setGeneratedKeyText(res.rawKey);
      setKeyName("");
      void refetchKeys();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to generate API key.");
    },
  });

  const deleteKey = api.apikeys.deleteKey.useMutation({
    onSuccess: () => {
      toast.success("API Key revoked.");
      void refetchKeys();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to revoke key.");
    },
  });

  const createWebhook = api.apikeys.createWebhookSubscription.useMutation({
    onSuccess: () => {
      toast.success("Webhook subscription created!");
      setWebhookUrl("");
      void refetchWebhooks();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create webhook subscription.");
    },
  });

  const deleteWebhook = api.apikeys.deleteWebhookSubscription.useMutation({
    onSuccess: () => {
      toast.success("Webhook subscription deleted.");
      setSelectedWebhookIdForLogs(null);
      void refetchWebhooks();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete webhook.");
    },
  });

  const handleCreateKey = () => {
    if (!keyName) return toast.error("Please enter a key identifier.");
    createKey.mutate({
      name: keyName,
      scopes: selectedScopes,
    });
  };

  const handleCreateWebhook = () => {
    if (!webhookUrl) return toast.error("Please enter a destination URL.");
    createWebhook.mutate({
      url: webhookUrl,
      events: selectedEvents,
    });
  };

  const handleCopyKey = () => {
    if (generatedKeyText) {
      void navigator.clipboard.writeText(generatedKeyText);
      toast.success("API key copied to clipboard!");
    }
  };

  const handleToggleScope = (scope: string) => {
    if (selectedScopes.includes(scope)) {
      setSelectedScopes(selectedScopes.filter((s) => s !== scope));
    } else {
      setSelectedScopes([...selectedScopes, scope]);
    }
  };

  const handleToggleEvent = (event: string) => {
    if (selectedEvents.includes(event)) {
      setSelectedEvents(selectedEvents.filter((e) => e !== event));
    } else {
      setSelectedEvents([...selectedEvents, event]);
    }
  };

  const availableScopes = [
    { value: "*", label: "Full Access (*)" },
    { value: "messages:read", label: "Read Messages" },
    { value: "messages:send", label: "Send Messages" },
    { value: "tickets:read", label: "Read Tickets" },
    { value: "tickets:write", label: "Write/Update Tickets" },
    { value: "contacts:read", label: "Read Contacts" },
    { value: "contacts:write", label: "Write Contacts" },
    { value: "automations:trigger", label: "Trigger Automations" },
  ];

  const availableEvents = [
    { value: "email.received", label: "Email Received" },
    { value: "ticket.created", label: "Ticket Created" },
    { value: "ticket.updated", label: "Ticket Updated" },
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start text-left">
      {/* Left Column: API Keys */}
      <div className="space-y-8">
        <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-md space-y-6">
          <div>
            <h3 className="text-md font-bold text-zinc-200 mb-1 flex items-center gap-2">
              <Terminal size={16} className="text-indigo-400" />
              Developer API Keys
            </h3>
            <p className="text-zinc-500 text-xs">Generate bearer tokens to programmatically send emails, manage tickets, and build custom applications.</p>
          </div>

          {/* Key creation form */}
          <div className="space-y-4 bg-zinc-950/40 p-4 rounded-xl border border-zinc-850">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Key Description/Name</label>
              <input
                type="text"
                placeholder="e.g., Jenkins CI or CRM Integration"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-855 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-2">Scope Permissions</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {availableScopes.map((scope) => (
                  <label key={scope.value} className="flex items-center gap-2 text-zinc-400 cursor-pointer hover:text-zinc-200 select-none">
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes(scope.value)}
                      onChange={() => handleToggleScope(scope.value)}
                      className="rounded border-zinc-800 bg-zinc-900 text-indigo-600 focus:ring-0"
                    />
                    <span>{scope.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={handleCreateKey}
              disabled={createKey.isPending}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              Generate Live Key
            </button>
          </div>

          {/* Raw key display card (shown once) */}
          {generatedKeyText && (
            <div className="p-4 rounded-xl border border-amber-500/10 bg-amber-500/5 text-amber-300 text-xs space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
              <div className="font-bold flex items-center gap-1.5 text-amber-400">
                <Shield size={14} />
                Copy API Key Now
              </div>
              <p className="text-[11px] leading-relaxed text-amber-300/80">
                This key will only be shown <span className="font-bold underline">once</span>. Please copy and store it securely.
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono bg-zinc-950 p-2 rounded-lg border border-zinc-855 flex-1 select-all break-all">{generatedKeyText}</span>
                <button
                  onClick={handleCopyKey}
                  className="p-2 hover:bg-zinc-900 rounded text-zinc-300 hover:text-white transition cursor-pointer"
                  title="Copy Key"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
          )}

          {/* List of current keys */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-zinc-400">Your Active API Keys</h4>
            {!keysList || keysList.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">No keys generated yet.</p>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {keysList.map((key) => {
                  let scopesArr = [];
                  try {
                    scopesArr = JSON.parse(key.scopes);
                  } catch (e) {}

                  return (
                    <div key={key.id} className="p-3 rounded-lg border border-zinc-855 bg-zinc-950/40 flex items-center justify-between gap-4">
                      <div className="min-w-0 space-y-1">
                        <div className="text-xs font-bold text-zinc-200">{key.name}</div>
                        <div className="text-[10px] text-zinc-550 font-mono tracking-wider">
                          Prefix: {key.keyPrefix}****
                        </div>
                        <div className="text-[9px] text-zinc-450 flex flex-wrap gap-1">
                          {scopesArr.map((s: string, idx: number) => (
                            <span key={idx} className="bg-zinc-900 px-1 py-0.2 rounded border border-zinc-800/80">{s}</span>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteKey.mutate({ id: key.id })}
                        className="p-1.5 hover:bg-zinc-900 rounded text-zinc-500 hover:text-rose-400 transition cursor-pointer flex-shrink-0"
                        title="Revoke Key"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Outbound Webhooks */}
      <div className="space-y-8">
        <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-md space-y-6">
          <div>
            <h3 className="text-md font-bold text-zinc-200 mb-1 flex items-center gap-2">
              <Lock size={16} className="text-indigo-400" />
              Outbound Webhooks
            </h3>
            <p className="text-zinc-500 text-xs">Deliver realtime events (like new messages or ticket updates) directly to your servers.</p>
          </div>

          {/* Webhook form */}
          <div className="space-y-4 bg-zinc-950/40 p-4 rounded-xl border border-zinc-850">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Destination URL</label>
              <input
                type="url"
                placeholder="https://api.yourcompany.com/webhooks/gusion"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-855 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-2">Subscribe to Events</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {availableEvents.map((ev) => (
                  <label key={ev.value} className="flex items-center gap-2 text-zinc-400 cursor-pointer hover:text-zinc-200 select-none">
                    <input
                      type="checkbox"
                      checked={selectedEvents.includes(ev.value)}
                      onChange={() => handleToggleEvent(ev.value)}
                      className="rounded border-zinc-800 bg-zinc-900 text-indigo-600 focus:ring-0"
                    />
                    <span>{ev.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={handleCreateWebhook}
              disabled={createWebhook.isPending}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              Add Webhook Endpoint
            </button>
          </div>

          {/* Webhook subscriptions list */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-zinc-400">Endpoints</h4>
            {!webhooksList || webhooksList.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">No webhook endpoints configured.</p>
            ) : (
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                {webhooksList.map((wh) => {
                  let eventsArr = [];
                  try {
                    eventsArr = JSON.parse(wh.events);
                  } catch (e) {}

                  return (
                    <div
                      key={wh.id}
                      onClick={() => setSelectedWebhookIdForLogs(wh.id)}
                      className={`p-3 rounded-lg border flex items-center justify-between gap-4 cursor-pointer transition ${
                        selectedWebhookIdForLogs === wh.id
                          ? "bg-indigo-950/20 border-indigo-500/30"
                          : "bg-zinc-950/40 border-zinc-855 hover:bg-zinc-950/60"
                      }`}
                    >
                      <div className="min-w-0 text-left space-y-1">
                        <div className="text-xs font-bold text-zinc-200 truncate">{wh.url}</div>
                        <div className="text-[10px] text-zinc-500 font-mono select-all">
                          Secret: {wh.secret}
                        </div>
                        <div className="text-[9px] text-zinc-450 flex flex-wrap gap-1">
                          {eventsArr.map((ev: string, idx: number) => (
                            <span key={idx} className="bg-zinc-900 px-1 py-0.2 rounded border border-zinc-800/80">{ev}</span>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteWebhook.mutate({ id: wh.id });
                        }}
                        className="p-1.5 hover:bg-zinc-900 rounded text-zinc-500 hover:text-rose-400 transition cursor-pointer flex-shrink-0"
                        title="Delete Webhook"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Webhook logs panel */}
          {selectedWebhookIdForLogs && (
            <div className="border-t border-zinc-900 pt-6 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-zinc-350 flex items-center gap-1.5">
                  <Activity size={13} className="text-indigo-400" />
                  Delivery Logs
                </h4>
                <button
                  onClick={() => setSelectedWebhookIdForLogs(null)}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300 font-bold transition cursor-pointer"
                >
                  Close logs
                </button>
              </div>

              {!deliveryLogs || deliveryLogs.length === 0 ? (
                <p className="text-xs text-zinc-550 italic">No delivery events logged yet.</p>
              ) : (
                <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                  {deliveryLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-2.5 rounded border text-[11px] flex flex-col gap-1 ${
                        log.success
                          ? "bg-emerald-500/5 border-emerald-500/10"
                          : "bg-rose-500/5 border-rose-500/10"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-zinc-300 font-mono">{log.event}</span>
                        <span
                          className={`px-1 py-0.2 rounded text-[9px] font-semibold ${
                            log.success ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                          }`}
                        >
                          HTTP {log.responseStatus || "Error"}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                      {log.responseBody && (
                        <div className="bg-zinc-950 p-1.5 rounded font-mono text-[9px] text-zinc-500 truncate max-w-full">
                          Response: {log.responseBody}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
