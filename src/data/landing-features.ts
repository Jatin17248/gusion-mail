import {
  Keyboard,
  Bot,
  Sparkles,
  Calendar,
  Layers,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface FeatureItem {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const Features: FeatureItem[] = [
  {
    title: "Superhuman Navigation",
    description:
      "Archive, reply, snooze, or search with zero mouse clicks. Command palette, customizable shortcuts, and optimistic UI.",
    icon: Keyboard,
  },
  {
    title: "AI Draft Agent",
    description:
      "Describe your reply in plain text and watch a professional response write itself in real time.",
    icon: Bot,
  },
  {
    title: "Daily Morning Brief",
    description:
      "Wake up to a 3-sentence summary of yesterday's most critical email threads.",
    icon: Sparkles,
  },
  {
    title: "Integrated Scheduling",
    description:
      "Insert calendar slots directly into your draft with a keyboard shortcut. Let recipients book syncs directly.",
    icon: Calendar,
  },
  {
    title: "Unified Accounts",
    description:
      "Connect multiple Google, Workspace, or custom accounts. Read, search, and manage a unified priority view.",
    icon: Layers,
  },
  {
    title: "DPDP & GST Compliant",
    description:
      "100% of data is stored in secure Indian datacenters. Full GST-invoicing support.",
    icon: ShieldCheck,
  },
];
