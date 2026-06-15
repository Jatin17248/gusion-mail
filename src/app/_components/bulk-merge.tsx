import { useState, useMemo } from "react";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { FileSpreadsheet, Plus, Play, Info, Eye, Activity, X } from "lucide-react";

export function BulkMergeView() {
  const utils = api.useUtils();
  const { data: campaignsList, refetch: refetchCampaigns } = api.bulk.listCampaigns.useQuery();

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  // New Campaign Form States
  const [campaignName, setCampaignName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [csvText, setCsvText] = useState("");
  const [parsedData, setParsedData] = useState<{ headers: string[]; rows: Record<string, string>[] }>({
    headers: [],
    rows: [],
  });
  const [previewIdx, setPreviewIdx] = useState(0);

  // Queries for details
  const { data: campaignDetails } = api.bulk.getCampaignDetails.useQuery(
    { id: selectedCampaignId ?? "" },
    { enabled: !!selectedCampaignId }
  );

  // Mutations
  const createCampaign = api.bulk.createCampaign.useMutation({
    onSuccess: () => {
      toast.success("Bulk campaign created successfully!");
      setCreateOpen(false);
      setCampaignName("");
      setSubject("");
      setBody("");
      setCsvText("");
      setParsedData({ headers: [], rows: [] });
      void refetchCampaigns();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create campaign.");
    },
  });

  const startCampaign = api.bulk.startCampaign.useMutation({
    onSuccess: () => {
      toast.success("Campaign triggered and processing!");
      void refetchCampaigns();
      if (selectedCampaignId) {
        // Force refresh details
        void utils.bulk.getCampaignDetails.invalidate({ id: selectedCampaignId });
      }
    },
    onError: (err) => {
      toast.error(err.message || "Failed to start campaign.");
    },
  });

  // Simple CSV parser
  const handleCSVParse = (text: string) => {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line !== "");
    if (lines.length === 0) {
      setParsedData({ headers: [], rows: [] });
      return;
    }

    const headers = lines[0]!.split(",").map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      const values = line.split(",").map(v => v.trim());
      const rowObj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rowObj[h] = values[idx] ?? "";
      });
      return rowObj;
    });

    setParsedData({ headers, rows });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setCsvText(text);
      handleCSVParse(text);
    };
    reader.readAsText(file);
  };

  // String interpolation helper
  const personalize = (text: string, variables: Record<string, string>): string => {
    let result = text;
    for (const [key, val] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, "g"), val);
    }
    return result;
  };

  const currentPreviewEmail = useMemo(() => {
    if (parsedData.rows.length === 0) return null;
    const row = parsedData.rows[previewIdx] ?? parsedData.rows[0]!;
    return {
      to: row.email ?? "No email column found",
      subject: personalize(subject || "No Subject", row),
      body: personalize(body || "No Body", row),
    };
  }, [parsedData, previewIdx, subject, body]);

  const handleCreate = () => {
    if (!campaignName) return toast.error("Please enter a campaign name.");
    if (!subject) return toast.error("Please enter a subject.");
    if (!body) return toast.error("Please enter body content.");
    if (parsedData.rows.length === 0) return toast.error("Please upload or paste a CSV list with at least 1 recipient.");

    const emailHeaderPresent = parsedData.headers.some(h => h.toLowerCase() === "email");
    if (!emailHeaderPresent) {
      return toast.error("Your CSV headers must contain an 'email' column.");
    }

    const recipients = parsedData.rows.map(row => ({
      email: row.email ?? "",
      variables: row,
    })).filter(r => r.email !== "");

    createCampaign.mutate({
      name: campaignName,
      subject,
      body,
      recipients,
    });
  };

  return (
    <section className="flex-1 flex flex-col bg-zinc-950 overflow-y-auto p-6 md:p-8 space-y-8 text-left">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Bulk Sheets & CSV Mail Merge</h2>
          <p className="text-zinc-500 text-xs">Deliver personalized marketing updates and announcements to list targets safely.</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
        >
          <Plus size={14} /> New Campaign
        </button>
      </div>

      {/* Main Campaign List Dashboard */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        <div className="xl:col-span-2 space-y-4">
          <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-md space-y-4">
            <h3 className="text-md font-bold text-zinc-200 flex items-center gap-2">
              <FileSpreadsheet size={16} className="text-indigo-400" />
              Active Campaigns
            </h3>

            {!campaignsList || campaignsList.length === 0 ? (
              <p className="text-xs text-zinc-500 italic py-6 text-center">No campaigns created yet.</p>
            ) : (
              <div className="space-y-3">
                {campaignsList.map((campaign) => (
                  <div
                    key={campaign.id}
                    onClick={() => setSelectedCampaignId(campaign.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition flex items-center justify-between gap-4 ${
                      selectedCampaignId === campaign.id
                        ? "bg-indigo-950/20 border-indigo-500/30"
                        : "bg-zinc-950/40 border-zinc-855 hover:bg-zinc-950/60"
                    }`}
                  >
                    <div className="min-w-0 text-left space-y-1">
                      <div className="text-xs font-bold text-zinc-200">{campaign.name}</div>
                      <div className="text-[10px] text-zinc-450 truncate">
                        Subject: {campaign.subject}
                      </div>
                      <div className="text-[9px] text-zinc-550 flex items-center gap-3">
                        <span>Total: {campaign.totalRecipients}</span>
                        <span className="text-emerald-500 font-semibold">Sent: {campaign.sentCount}</span>
                        <span className="text-rose-500 font-semibold">Failed: {campaign.failedCount}</span>
                        <span>Date: {new Date(campaign.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${
                          campaign.status === "completed"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"
                            : campaign.status === "running"
                            ? "bg-indigo-500/10 text-indigo-400 animate-pulse border border-indigo-500/15"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {campaign.status}
                      </span>
                      {campaign.status === "pending" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startCampaign.mutate({ id: campaign.id });
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold transition cursor-pointer"
                        >
                          <Play size={10} /> Start
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Selected Campaign Details */}
        {selectedCampaignId && campaignDetails && (
          <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-md text-left space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-md font-bold text-zinc-200 flex items-center gap-2">
                <Activity size={16} className="text-indigo-400" />
                Campaign Progress
              </h3>
              <button
                onClick={() => setSelectedCampaignId(null)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-850 space-y-2 text-xs">
                <div className="font-bold text-zinc-350">{campaignDetails.campaign.name}</div>
                <div className="text-[10px] text-zinc-500">Status: <span className="font-semibold capitalize text-zinc-300">{campaignDetails.campaign.status}</span></div>
                <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-zinc-900 text-center">
                  <div>
                    <div className="font-bold text-zinc-300">{campaignDetails.campaign.totalRecipients}</div>
                    <div className="text-[9px] text-zinc-500">Recipients</div>
                  </div>
                  <div>
                    <div className="font-bold text-emerald-500">{campaignDetails.campaign.sentCount}</div>
                    <div className="text-[9px] text-zinc-500">Sent</div>
                  </div>
                  <div>
                    <div className="font-bold text-rose-500">{campaignDetails.campaign.failedCount}</div>
                    <div className="text-[9px] text-zinc-500">Failed</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-zinc-400">Recipient List Status</h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {campaignDetails.recipients.map((recipient) => (
                    <div key={recipient.id} className="p-2.5 rounded border border-zinc-855 bg-zinc-950/20 text-xs flex justify-between items-center gap-4">
                      <span className="text-zinc-350 font-medium truncate">{recipient.email}</span>
                      <div className="flex items-center gap-2">
                        {recipient.error && (
                          <span className="text-[9px] text-rose-400/90 max-w-[100px] truncate" title={recipient.error}>
                            {recipient.error}
                          </span>
                        )}
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase ${
                            recipient.status === "sent"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : recipient.status === "failed"
                              ? "bg-rose-500/10 text-rose-400"
                              : recipient.status === "unsubscribed"
                              ? "bg-amber-500/10 text-amber-400"
                              : "bg-zinc-800 text-zinc-500"
                          }`}
                        >
                          {recipient.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Campaign Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-4xl p-6 rounded-2xl border border-zinc-900 bg-zinc-900 shadow-2xl relative space-y-6 text-left my-8">
            <div className="flex justify-between items-center">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Plus size={16} className="text-indigo-400" />
                Configure Bulk Campaign
              </h3>
              <button
                onClick={() => setCreateOpen(false)}
                className="p-1 hover:bg-zinc-855 rounded text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Editor & CSV */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Campaign Name</label>
                  <input
                    type="text"
                    placeholder="e.g. June Newsletter"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-855 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Subject</label>
                  <input
                    type="text"
                    placeholder="e.g. Welcome to Gusion, {{firstName}}!"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-855 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Email Body</label>
                  <textarea
                    placeholder="Hi {{firstName}},\n\nWelcome to {{company}}!"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={6}
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-855 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 resize-y"
                  />
                  <div className="text-[10px] text-zinc-550 mt-1 flex items-center gap-1">
                    <Info size={10} />
                    <span>Use double curly brackets (e.g. <code>{"{{firstName}}"}</code>) to interpolate variables from your CSV columns.</span>
                  </div>
                </div>

                {/* CSV Input */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-semibold text-zinc-400">CSV List (Headers: email, name, etc.)</label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="csv-file-upload"
                    />
                    <label
                      htmlFor="csv-file-upload"
                      className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer"
                    >
                      Upload .csv File
                    </label>
                  </div>
                  <textarea
                    placeholder="email,firstName,company&#10;customer@gmail.com,Alice,Google"
                    value={csvText}
                    onChange={(e) => {
                      setCsvText(e.target.value);
                      handleCSVParse(e.target.value);
                    }}
                    rows={4}
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-855 rounded-lg text-xs text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Right Column: Parsed preview & Columns */}
              <div className="space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-400 mb-2">Parsed Columns</h4>
                    {parsedData.headers.length === 0 ? (
                      <p className="text-[11px] text-zinc-550 italic">No columns parsed yet. Paste CSV content to view variables.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {parsedData.headers.map((h, i) => (
                          <span
                            key={i}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              h.toLowerCase() === "email"
                                ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                                : "bg-zinc-850 text-zinc-400 border-zinc-800"
                            }`}
                          >
                            {"{{" + h + "}}"}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Preview email */}
                  {currentPreviewEmail && (
                    <div className="p-4 rounded-xl border border-zinc-855 bg-zinc-950/40 space-y-3">
                      <div className="flex justify-between items-center text-xs border-b border-zinc-900 pb-2">
                        <span className="font-bold text-zinc-400 flex items-center gap-1">
                          <Eye size={12} className="text-indigo-400" /> Preview Draft
                        </span>
                        {parsedData.rows.length > 1 && (
                          <div className="flex gap-1.5 items-center">
                            <button
                              onClick={() => setPreviewIdx(Math.max(0, previewIdx - 1))}
                              disabled={previewIdx === 0}
                              className="px-1 bg-zinc-900 hover:bg-zinc-800 rounded disabled:opacity-50 text-[10px]"
                            >
                              &larr;
                            </button>
                            <span className="text-[10px] text-zinc-500">{previewIdx + 1} of {parsedData.rows.length}</span>
                            <button
                              onClick={() => setPreviewIdx(Math.min(parsedData.rows.length - 1, previewIdx + 1))}
                              disabled={previewIdx === parsedData.rows.length - 1}
                              className="px-1 bg-zinc-900 hover:bg-zinc-800 rounded disabled:opacity-50 text-[10px]"
                            >
                              &rarr;
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="text-[11px] space-y-1">
                        <div className="text-zinc-500"><span className="font-bold">To:</span> {currentPreviewEmail.to}</div>
                        <div className="text-zinc-500"><span className="font-bold">Subject:</span> {currentPreviewEmail.subject}</div>
                        <div className="text-zinc-300 mt-2 bg-zinc-950/60 p-3 rounded-lg font-sans whitespace-pre-wrap border border-zinc-900/60 max-h-[160px] overflow-y-auto">
                          {currentPreviewEmail.body}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-zinc-900 flex gap-3">
                  <button
                    onClick={() => setCreateOpen(false)}
                    className="flex-1 py-2 bg-zinc-900 hover:bg-zinc-855 border border-zinc-800 text-zinc-200 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={createCampaign.isPending}
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                  >
                    {createCampaign.isPending ? "Creating..." : `Create & Queue (${parsedData.rows.length} emails)`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
