import { useState } from "react";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { Sliders, Plus, Trash2, SlidersHorizontal, Activity } from "lucide-react";
import { parseRuleConditions, parseAutomationActions } from "@/server/lib/automation";

export function AutomationsSettingsView() {
  const { data: rulesList, refetch: refetchRules } = api.automation.listRules.useQuery();
  const { data: runsList } = api.automation.listRuns.useQuery();
  const { data: members } = api.org.listMembers.useQuery();

  const [name, setName] = useState("");
  const [conditions, setConditions] = useState<{ id: string; field: string; operator: string; value: string }[]>([
    { id: crypto.randomUUID(), field: "subject", operator: "contains", value: "" },
  ]);
  const [actions, setActions] = useState<{ id: string; type: string; value: string }[]>([
    { id: crypto.randomUUID(), type: "change_status", value: "pending" },
  ]);

  const createRule = api.automation.createRule.useMutation({
    onSuccess: () => {
      toast.success("Automation rule created!");
      setName("");
      setConditions([{ id: crypto.randomUUID(), field: "subject", operator: "contains", value: "" }]);
      setActions([{ id: crypto.randomUUID(), type: "change_status", value: "pending" }]);
      void refetchRules();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create rule.");
    },
  });

  const deleteRule = api.automation.deleteRule.useMutation({
    onSuccess: () => {
      toast.success("Rule deleted.");
      void refetchRules();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete rule.");
    },
  });

  const toggleRule = api.automation.updateRule.useMutation({
    onSuccess: () => {
      toast.success("Rule status updated.");
      void refetchRules();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update rule.");
    },
  });

  const addCondition = () => {
    setConditions([...conditions, { id: crypto.randomUUID(), field: "subject", operator: "contains", value: "" }]);
  };

  const removeCondition = (idx: number) => {
    setConditions(conditions.filter((_, i) => i !== idx));
  };

  const updateCondition = (idx: number, key: string, val: string) => {
    setConditions(
      conditions.map((c, i) => (i === idx ? { ...c, [key]: val } : c))
    );
  };

  const addAction = () => {
    setActions([...actions, { id: crypto.randomUUID(), type: "change_status", value: "pending" }]);
  };

  const removeAction = (idx: number) => {
    setActions(actions.filter((_, i) => i !== idx));
  };

  const updateAction = (idx: number, key: string, val: string) => {
    setActions(
      actions.map((a, i) => (i === idx ? { ...a, [key]: val } : a))
    );
  };

  const handleCreateRule = () => {
    if (!name) return toast.error("Please enter a rule name.");
    const emptyCondition = conditions.find((c) => !c.value.trim());
    if (emptyCondition) return toast.error("All condition values must be filled in.");
    createRule.mutate({
      name,
      triggerType: "email_received",
      conditions: JSON.stringify(conditions),
      actions: JSON.stringify(actions),
    });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
      {/* Rule Creator */}
      <div className="xl:col-span-2 space-y-6">
        <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-md text-left space-y-6">
          <div>
            <h3 className="text-base font-bold text-zinc-200 mb-1 flex items-center gap-2">
              <Sliders size={16} className="text-indigo-400" />
              Build New Automation Rule
            </h3>
            <p className="text-zinc-500 text-xs">Define triggers, match criteria, and automate ticket assignments or replies.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Rule Name</label>
              <input
                type="text"
                placeholder="e.g., Auto-assign Billing tickets"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            {/* Conditions Builder */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-zinc-400">WHEN email is received AND:</span>
                <button
                  onClick={addCondition}
                  className="flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
                >
                  <Plus size={12} /> Add Condition
                </button>
              </div>

              {conditions.map((cond, idx) => (
                <div key={cond.id} className="flex gap-2 items-center bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-800">
                  <select
                    value={cond.field}
                    onChange={(e) => updateCondition(idx, "field", e.target.value)}
                    className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-300"
                  >
                    <option value="subject">Subject</option>
                    <option value="from">From Email</option>
                    <option value="body">Body Content</option>
                    <option value="priority">AI Priority</option>
                  </select>

                  <select
                    value={cond.operator}
                    onChange={(e) => updateCondition(idx, "operator", e.target.value)}
                    className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-300"
                  >
                    <option value="contains">contains</option>
                    <option value="equals">equals</option>
                    <option value="starts_with">starts with</option>
                    <option value="ends_with">ends with</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Value (e.g. billing)"
                    value={cond.value}
                    onChange={(e) => updateCondition(idx, "value", e.target.value)}
                    className="flex-1 px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                  />

                  {conditions.length > 1 && (
                    <button
                      onClick={() => removeCondition(idx)}
                      className="text-zinc-500 hover:text-rose-400 transition cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Actions Builder */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-zinc-400">THEN perform actions:</span>
                <button
                  onClick={addAction}
                  className="flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
                >
                  <Plus size={12} /> Add Action
                </button>
              </div>

              {actions.map((act, idx) => (
                <div key={act.id} className="flex gap-2 items-start bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-800">
                  <select
                    value={act.type}
                    onChange={(e) => updateAction(idx, "type", e.target.value)}
                    className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-300 mt-0.5"
                  >
                    <option value="change_status">Change Status</option>
                    <option value="assign">Assign Ticket To</option>
                    <option value="tag">Add Label/Tag</option>
                    <option value="auto_reply">Auto Reply Template</option>
                    <option value="webhook">Outbound Webhook Trigger</option>
                  </select>

                  {act.type === "change_status" && (
                    <select
                      value={act.value}
                      onChange={(e) => updateAction(idx, "value", e.target.value)}
                      className="flex-1 px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-200"
                    >
                      <option value="open">Open</option>
                      <option value="pending">Pending</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  )}

                  {act.type === "assign" && (
                    <select
                      value={act.value}
                      onChange={(e) => updateAction(idx, "value", e.target.value)}
                      className="flex-1 px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-200"
                    >
                      <option value="">Unassigned</option>
                      {members?.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name || m.email} ({m.role})
                        </option>
                      ))}
                    </select>
                  )}

                  {act.type === "tag" && (
                    <input
                      type="text"
                      placeholder="Tag name (e.g. billing)"
                      value={act.value}
                      onChange={(e) => updateAction(idx, "value", e.target.value)}
                      className="flex-1 px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                    />
                  )}

                  {act.type === "auto_reply" && (
                    <textarea
                      placeholder="Enter reply template..."
                      value={act.value}
                      onChange={(e) => updateAction(idx, "value", e.target.value)}
                      rows={2}
                      className="flex-1 px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 resize-y"
                    />
                  )}

                  {act.type === "webhook" && (
                    <input
                      type="url"
                      placeholder="https://api.yourcompany.com/webhook"
                      value={act.value}
                      onChange={(e) => updateAction(idx, "value", e.target.value)}
                      className="flex-1 px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                    />
                  )}

                  {actions.length > 1 && (
                    <button
                      onClick={() => removeAction(idx)}
                      className="text-zinc-500 hover:text-rose-400 transition cursor-pointer mt-1"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleCreateRule}
            disabled={createRule.isPending}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50"
          >
            {createRule.isPending ? "Creating Rule..." : "Save Automation Rule"}
          </button>
        </div>

        {/* Existing Rules List */}
        <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-md text-left space-y-4">
          <h3 className="text-base font-bold text-zinc-200 flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-indigo-400" />
            Configured Rules
          </h3>

          {!rulesList || rulesList.length === 0 ? (
            <p className="text-xs text-zinc-500 italic">No automation rules configured yet.</p>
          ) : (
            <div className="space-y-3">
              {rulesList.map((rule) => {
                const conds = parseRuleConditions(rule.conditions);
                const acts = parseAutomationActions(rule.actions);

                return (
                  <div
                    key={rule.id}
                    className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/40 flex items-start justify-between gap-4"
                  >
                    <div className="space-y-2 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-200">{rule.name}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                            rule.isActive ? "bg-indigo-500/10 text-indigo-400" : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {rule.isActive ? "Active" : "Disabled"}
                        </span>
                      </div>

                      <div className="text-[10px] text-zinc-400 space-y-1">
                        <div>
                          <span className="text-zinc-500 font-bold">Conditions:</span>{" "}
                          {conds.map((c, i) => (
                            <span key={i} className="bg-zinc-900 px-1 py-0.5 rounded text-zinc-300 mr-1">
                              {c.field} {c.operator} &quot;{c.value}&quot;
                            </span>
                          ))}
                        </div>
                        <div>
                          <span className="text-zinc-500 font-bold">Actions:</span>{" "}
                          {acts.map((a, i) => (
                            <span key={i} className="bg-indigo-950/20 px-1 py-0.5 rounded text-indigo-400 mr-1 border border-indigo-500/10">
                              {a.type} &rarr; {a.value}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleRule.mutate({ id: rule.id, isActive: !rule.isActive })}
                        className="px-2 py-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded text-[10px] font-bold text-zinc-300 transition cursor-pointer"
                      >
                        {rule.isActive ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => deleteRule.mutate({ id: rule.id })}
                        className="p-1 hover:bg-zinc-900 rounded text-zinc-500 hover:text-rose-400 transition cursor-pointer"
                        title="Delete Rule"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Runs Log */}
      <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-md text-left space-y-4 h-full xl:sticky xl:top-6">
        <h3 className="text-base font-bold text-zinc-200 flex items-center gap-2">
          <Activity size={16} className="text-indigo-400" />
          Automation Runs Log
        </h3>
        <p className="text-zinc-500 text-xs">Real-time status of recently evaluated automation rules.</p>

        {!runsList || runsList.length === 0 ? (
          <p className="text-xs text-zinc-500 italic">No automation executions recorded yet.</p>
        ) : (
          <div className="space-y-3 max-h-125 overflow-y-auto pr-1">
            {runsList.map((run) => (
              <div
                key={run.id}
                className={`p-3 rounded-lg border text-xs ${
                  run.status === "success"
                    ? "bg-emerald-500/5 border-emerald-500/10"
                    : "bg-rose-500/5 border-rose-500/10"
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-zinc-300 truncate max-w-[70%]">
                    {(run as { ruleName?: string }).ruleName ?? "Rule triggered"}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${
                      run.status === "success"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-rose-500/10 text-rose-400"
                    }`}
                  >
                    {run.status}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">
                  Date: {new Date(run.createdAt).toLocaleString()}
                </div>
                {run.error && (
                  <div className="text-[10px] text-rose-400 mt-1 bg-rose-500/10 p-1.5 rounded">
                    Error: {run.error}
                  </div>
                )}
                {run.actionsExecuted && (
                  <div className="text-[10px] text-zinc-400 mt-1">
                    Executed: <span className="font-mono text-[9px] text-zinc-500">{run.actionsExecuted}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
