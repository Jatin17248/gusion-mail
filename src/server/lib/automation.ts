import { z } from "zod";

export const automationActionSchema = z.object({
  type: z.enum([
    "assign",
    "change_status",
    "add_label",
    "tag",
    "auto_reply",
    "webhook",
  ]),
  value: z.string(),
});

export type AutomationAction = z.infer<typeof automationActionSchema>;

export const ruleConditionSchema = z.object({
  field: z.enum(["subject", "from", "body", "priority"]),
  operator: z.enum(["equals", "contains", "starts_with", "ends_with"]),
  value: z.string(),
});

export type RuleCondition = z.infer<typeof ruleConditionSchema>;

/** Parse a rule's stored `conditions` JSON into typed conditions. */
export function parseRuleConditions(
  json: string | null | undefined,
): RuleCondition[] {
  if (!json) return [];
  try {
    const raw: unknown = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    const out: RuleCondition[] = [];
    for (const item of raw) {
      const parsed = ruleConditionSchema.safeParse(item);
      if (parsed.success) out.push(parsed.data);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Parse a rule's stored `actions` JSON into typed actions, silently dropping
 * malformed entries. Rules store actions as a JSON string column.
 */
export function parseAutomationActions(
  json: string | null | undefined,
): AutomationAction[] {
  if (!json) return [];
  try {
    const raw: unknown = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    const out: AutomationAction[] = [];
    for (const item of raw) {
      const parsed = automationActionSchema.safeParse(item);
      if (parsed.success) out.push(parsed.data);
    }
    return out;
  } catch {
    return [];
  }
}
