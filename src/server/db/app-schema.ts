import {
  timestamp,
  pgTable,
  text,
  primaryKey,
  integer,
  boolean,
  unique,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  corsairTenantId: text("corsair_tenant_id").unique(),
  gmailConnected: boolean("gmail_connected").default(false),
  calendarConnected: boolean("calendar_connected").default(false),
  viralSignatureEnabled: boolean("viral_signature_enabled").default(true),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { mode: "date" }),
  referralCode: text("referral_code").unique(),
  referredByCode: text("referred_by_code"),
  trialStartedAt: timestamp("trial_started_at", { mode: "date" }),
  activeOrgId: text("active_org_id"),
  passwordHash: text("password_hash"),
  passwordResetToken: text("password_reset_token"),
  passwordResetTokenExpiry: timestamp("password_reset_token_expiry", { mode: "date" }),
  isStaff: boolean("is_staff").default(false).notNull(),
  suspendedAt: timestamp("suspended_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    {
      parent: primaryKey({
        columns: [account.provider, account.providerAccountId],
      }),
    },
  ]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => [
    {
      parent: primaryKey({
        columns: [verificationToken.identifier, verificationToken.token],
      }),
    },
  ]
);

export const subscriptions = pgTable("subscriptions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  payuCustomerId: text("payu_customer_id"),
  payuSubscriptionId: text("payu_subscription_id"),
  plan: text("plan").notNull().default("free"), // 'free' | 'pro' | 'team'
  status: text("status"), // 'active', 'trialing', 'past_due', 'canceled'
  currentPeriodEnd: timestamp("current_period_end", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const emailMeta = pgTable("email_meta", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  gmailMessageId: text("gmail_message_id").notNull(),
  threadId: text("thread_id").notNull(),
  priority: text("priority").default("normal"), // 'urgent' | 'high' | 'normal' | 'low'
  priorityReason: text("priority_reason"),
  category: text("category"), // e.g. 'important', 'other'
  isSnoozed: boolean("is_snoozed").default(false),
  snoozeUntil: timestamp("snooze_until", { mode: "date" }),
  isPinned: boolean("is_pinned").default(false),
  isVipSender: boolean("is_vip_sender").default(false),
  readAt: timestamp("read_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  receivedAt: timestamp("received_at", { mode: "date" }).defaultNow().notNull(),
  processedAt: timestamp("processed_at", { mode: "date" }),
  status: text("status").notNull(), // 'processed' / 'failed'
  payloadHash: text("payload_hash"),
});

export const agentMessages = pgTable("agent_messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'user' | 'assistant' | 'system' | 'tool'
  content: text("content"),
  toolCalls: text("tool_calls"), // JSON string
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  metadata: text("metadata"), // JSON string or text info
  ip: text("ip"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const savedSearches = pgTable("saved_searches", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  query: text("query").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const templates = pgTable("templates", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  shortcut: text("shortcut").notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
  variables: text("variables"), // JSON string representing placeholders
  isShared: boolean("is_shared").default(false),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const sendQueue = pgTable("send_queue", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  rawBase64Url: text("raw_base64_url").notNull(),
  threadId: text("thread_id"),
  sendAt: timestamp("send_at", { mode: "date" }).notNull(),
  status: text("status").default("pending"), // 'pending', 'sent', 'failed'
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const followUps = pgTable("follow_ups", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  threadId: text("thread_id").notNull(),
  sentMessageId: text("sent_message_id").notNull(),
  remindAt: timestamp("remind_at", { mode: "date" }).notNull(),
  reason: text("reason"),
  status: text("status").default("pending"), // 'pending', 'reminded', 'dismissed'
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const schedulingLinks = pgTable("scheduling_links", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  slug: text("slug").unique().notNull(),
  title: text("title").notNull(),
  durationMins: integer("duration_mins").notNull(),
  bufferMins: integer("buffer_mins").default(0),
  availability: text("availability"), // JSON string representing slots/rules
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const bookings = pgTable("bookings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  schedulingLinkId: text("scheduling_link_id")
    .notNull()
    .references(() => schedulingLinks.id, { onDelete: "cascade" }),
  inviteeEmail: text("invitee_email").notNull(),
  inviteeName: text("invitee_name").notNull(),
  start: timestamp("start", { mode: "date" }).notNull(),
  end: timestamp("end", { mode: "date" }).notNull(),
  calendarEventId: text("calendar_event_id"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const contacts = pgTable("contacts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  name: text("name"),
  lastInteractionAt: timestamp("last_interaction_at", { mode: "date" }),
  interactionCount: integer("interaction_count").default(0),
  isVip: boolean("is_vip").default(false),
  enrichment: text("enrichment"), // JSON string representing company/social
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => [
  {
    parent: unique().on(table.userId, table.email),
  },
]);

export const referrals = pgTable("referrals", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  referrerUserId: text("referrer_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  referredEmail: text("referred_email").notNull(),
  status: text("status").default("pending"), // 'pending' | 'joined' | 'rewarded'
  rewardGrantedAt: timestamp("reward_granted_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const orgMembers = pgTable("org_members", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // 'owner' | 'admin' | 'member'
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const tickets = pgTable("tickets", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  publicId: text("public_id").unique().notNull(), // "GSN-1001"
  gmailMessageId: text("gmail_message_id"),
  threadId: text("thread_id"),
  subject: text("subject").notNull(),
  snippet: text("snippet"),
  status: text("status").default("open").notNull(), // 'open' | 'pending' | 'resolved'
  assignedUserId: text("assigned_user_id").references(() => users.id, { onDelete: "set null" }),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name"),
  tags: text("tags"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const rules = pgTable("rules", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  triggerType: text("trigger_type").notNull().default("email_received"),
  conditions: text("conditions").notNull().default("[]"), // JSON string
  actions: text("actions").notNull().default("[]"), // JSON string
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const automationRuns = pgTable("automation_runs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  ruleId: text("rule_id")
    .notNull()
    .references(() => rules.id, { onDelete: "cascade" }),
  gmailMessageId: text("gmail_message_id"),
  status: text("status").notNull(), // 'success' | 'failed'
  error: text("error"),
  actionsExecuted: text("actions_executed"), // JSON string
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  keyPrefix: text("key_prefix").notNull().default("gsn_live_"),
  hashedKey: text("hashed_key").unique().notNull(),
  scopes: text("scopes").notNull().default("[]"), // JSON string
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const outboundWebhooks = pgTable("outbound_webhooks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  events: text("events").notNull().default("[]"), // JSON string
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const webhookDeliveryLogs = pgTable("webhook_delivery_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  webhookId: text("webhook_id")
    .notNull()
    .references(() => outboundWebhooks.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  payload: text("payload").notNull(),
  responseStatus: integer("response_status"),
  responseBody: text("response_body"),
  success: boolean("success").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const bulkCampaigns = pgTable("bulk_campaigns", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").default("pending").notNull(), // 'pending' | 'running' | 'completed' | 'failed'
  totalRecipients: integer("total_recipients").default(0).notNull(),
  sentCount: integer("sent_count").default(0).notNull(),
  failedCount: integer("failed_count").default(0).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const bulkRecipients = pgTable("bulk_recipients", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => bulkCampaigns.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  variables: text("variables").notNull().default("{}"), // JSON string
  status: text("status").default("pending").notNull(), // 'pending' | 'sent' | 'failed' | 'unsubscribed'
  sentAt: timestamp("sent_at", { mode: "date" }),
  error: text("error"),
});

export const suppressionList = pgTable("suppression_list", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => [
  {
    parent: unique().on(table.orgId, table.email),
  },
]);

export const sharedMailboxes = pgTable("shared_mailboxes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  connectionStatus: text("connection_status").default("pending"), // 'connected' | 'pending' | 'failed'
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const ticketEvents = pgTable("ticket_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  ticketId: text("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "set null" }), // User who performed the action
  type: text("type").notNull(), // 'note' | 'status_change' | 'assignment'
  content: text("content"), // The internal note or the details of the change
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const connectedAccounts = pgTable("connected_accounts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("google"),
  email: text("email").notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const teamInvitations = pgTable("team_invitations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull().default("member"),
  token: text("token").notNull().unique(),
  invitedByUserId: text("invited_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"), // 'pending' | 'accepted' | 'expired'
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const systemConfigs = pgTable("system_configs", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  updatedByUserId: text("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
});
