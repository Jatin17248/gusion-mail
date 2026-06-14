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
  onboardingCompletedAt: timestamp("onboarding_completed_at", { mode: "date" }),
  referralCode: text("referral_code").unique(),
  referredByCode: text("referred_by_code"),
  trialStartedAt: timestamp("trial_started_at", { mode: "date" }),
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
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
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

