"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { Plus, Trash2, Edit2 } from "lucide-react";

export function TemplatesSettingsView() {
  const { data: templates, refetch } = api.template.listTemplates.useQuery();

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [shortcut, setShortcut] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const createMutation = api.template.createTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template created!");
      setIsCreating(false);
      resetForm();
      void refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = api.template.updateTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template updated!");
      setEditingId(null);
      resetForm();
      void refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = api.template.deleteTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template deleted!");
      void refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const resetForm = () => {
    setName("");
    setShortcut("");
    setSubject("");
    setBody("");
  };

  const startEdit = (t: { id: string; name: string; shortcut: string; subject: string | null; body: string }) => {
    setEditingId(t.id);
    setName(t.name);
    setShortcut(t.shortcut);
    setSubject(t.subject ?? "");
    setBody(t.body);
  };

  const handleSave = () => {
    if (!name || !shortcut || !body) {
      toast.error("Name, shortcut, and body are required");
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, name, shortcut, subject, body });
    } else {
      createMutation.mutate({ name, shortcut, subject, body });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-white">Email Templates</h3>
          <p className="text-sm text-zinc-400">Create snippets to quickly insert into emails.</p>
        </div>
        {!isCreating && !editingId && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-medium transition"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        )}
      </div>

      {(isCreating || editingId) && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
          <h4 className="text-md font-medium text-white">{editingId ? "Edit Template" : "New Template"}</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Template Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sales Intro"
                className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Keyboard Shortcut</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-zinc-500 text-sm">/</span>
                <input
                  type="text"
                  value={shortcut}
                  onChange={(e) => setShortcut(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''))}
                  placeholder="intro"
                  className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-md pl-6 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Subject (Optional)</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Will override current subject if set"
              className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="Hi {{name}},\n\nTemplate content here..."
              className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-y"
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button
              onClick={() => {
                setIsCreating(false);
                setEditingId(null);
                resetForm();
              }}
              className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-zinc-200 transition disabled:opacity-50"
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Template"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {templates?.length === 0 && !isCreating && (
          <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-xl p-8 text-center">
            <p className="text-zinc-500 text-sm">No templates yet. Create one to type faster.</p>
          </div>
        )}
        
        {templates?.map((t) => (
          <div key={t.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between group">
            <div className="space-y-1 overflow-hidden w-full">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-white truncate">{t.name}</h4>
                <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded text-xs font-mono">
                  /{t.shortcut}
                </span>
              </div>
              <p className="text-xs text-zinc-500 truncate">{t.subject ? `Subj: ${t.subject}` : "No subject override"}</p>
              <p className="text-sm text-zinc-400 truncate line-clamp-1">{t.body}</p>
            </div>
            
            <div className="flex items-center gap-2 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition">
              <button
                onClick={() => startEdit(t)}
                className="p-2 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-md transition"
                title="Edit template"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  if (confirm("Delete this template?")) {
                    deleteMutation.mutate({ id: t.id });
                  }
                }}
                className="p-2 hover:bg-red-900/30 text-zinc-500 hover:text-red-400 rounded-md transition"
                title="Delete template"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
