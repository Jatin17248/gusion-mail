# Gusion Mail — End-to-End Product & Engineering Plan

> The AI command center for email + calendar. Triage your inbox at the speed of thought, let an agent run your scheduling, and never write the same email twice.
> **This is the single source of truth** for building Gusion Mail from a fresh repo to a public, paid product people love and tell their friends about.

- **Owner:** Jatin Sood
- **Last updated:** 2026-06-14
- **Status:** Building. Backend ~Phases 0–6 done (`tsc` clean, 36/36 tests). Pivoting to add an **Organization/Team layer + helpdesk tickets + automation engine + public API + bulk mail-merge** (decided 2026-06-14). Next: surface trapped features (Sprints S1–S3), then org foundation (P11).
- **Positioning (two-layer).** **Wedge:** prosumer Superhuman-grade speed + AI-native (individual Pro). **Expansion:** team shared-inbox + support tickets + automation engine + developer API/webhooks + bulk mail-merge (seat-based Team + Platform add-on). **Org is now the billing/data boundary** (a solo user = 1-person org).
- **Stack (locked):** Next.js 15 (App Router, React 19) · tRPC v11 · TailwindCSS v4 · Framer Motion · Drizzle ORM · Neon (Serverless Postgres) · Upstash Redis + **QStash (default queue; BullMQ worker optional for bulk send)** · Corsair (`gmail`, `googlecalendar`) · Google Gemini · Stripe · Vercel

---

## Table of Contents
1. Vision, positioning & target user
2. **Feature Catalog** (the attract-and-retain surface)
3. Current state audit (what already exists)
4. Gap analysis: demo → lovable paid product
5. Target architecture
6. Data model
7. Phased roadmap (Goal / Tasks / Acceptance)
8. Security, privacy & compliance (the launch gate)
9. Monetization & pricing
10. Growth, virality & go-to-market
11. Testing & QA
12. Observability & SRE
13. Deployment & infrastructure
14. Risk register
15. Milestones & timeline
16. Launch checklist (Definition of Done)
17. Open decisions
- Appendix A — Corsair endpoint discipline
- Appendix B — File-level change map

---

## 1. Vision, Positioning & Target User

**Vision.** Email and calendar are the same job — "what needs my attention, and what do I do about it?" — split across two clumsy apps. Gusion Mail fuses them into one keyboard-first, AI-native command center where the common workflows (reply, schedule, follow up, find a time) take one keystroke or one sentence.

**Who we're for (in priority order):**
1. **Founders, execs, investors, recruiters, sales** — high email volume, calendar is their bottleneck, will pay for time saved.
2. **Power users / developers** — love keyboard-first tools and AI, early adopters and evangelists.
3. **Teams** (later) — once individuals love it, sell shared snippets/inbox/analytics seat-by-seat.

**Why people switch (the hooks):**
- **Speed** — feels instant; you can run your whole inbox without a mouse.
- **AI that does the work** — drafts replies, summarizes threads, catches you up, and *acts* via an agent.
- **Scheduling that doesn't suck** — share a link, "find a time," invite from an email in one keystroke.
- **It pulls people in** — every scheduling link and (optional) signature is a tiny ad; referrals give free months.

**Non-goals (for v1):** building our own mail server, supporting non-Google providers (Outlook/IMAP later), mobile-native apps (ship a great PWA first).

---

## 2. Feature Catalog

The product surface, grouped by theme. Each feature is tagged:
- **Tier** — `MVP` (private beta), `V1` (paid GA), `V2` (post-launch).
- **Plan** — `Free`, `Pro`, `Team`.
- **★** marks a *wow / attract* feature we lead with in demos and marketing.

### 2.1 Email — fast triage (table stakes, but Superhuman-grade)
| Feature | Tier | Plan | Notes |
|---|---|---|---|
| Split Inbox / Smart views (Important · Other · Newsletters · VIP · Team) ★ | MVP | Free | The core "calm inbox" feel; powered by AI priority + rules |
| Threaded conversations, read/unread, pin/star | MVP | Free | |
| Archive / delete / mark spam / move | MVP | Free | Live Gmail `messages.modify` |
| Optimistic everything + Undo Send ★ | MVP | Free | ~5s queued send with toast |
| Multiple accounts / unified inbox ★ | V1 | Pro | One tenant per connected Google account |
| Compose with To/Cc/Bcc, attachments, `Cmd+Enter` send | MVP | Free | |
| Rich + plain text, signatures | V1 | Free | |

### 2.2 Email — productivity superpowers (differentiators)
| Feature | Tier | Plan | Notes |
|---|---|---|---|
| **Snooze** ("remind me later", returns to top at chosen time) ★ | V1 | Free | `email_meta.snoozeUntil` + QStash wake |
| **Send Later / Schedule send** ★ | V1 | Pro | `send_queue` + QStash |
| **Follow-up nudges** ("remind me if no reply in 3 days") ★ | V1 | Pro | Resurfaces sent mail with no response |
| **Snippets / templates** with variables + keyboard expansion ★ | V1 | Pro | `templates`; shared on Team |
| **Read statuses** (open tracking on sent mail) ★ | V2 | Pro | Privacy-sensitive — opt-in, disclosed; see §8 |
| Auto-BCC to CRM / forwarding rules | V2 | Pro | |
| Bulk actions / select-all triage | V1 | Free | |

### 2.3 AI — the biggest reason to switch (Gemini)
| Feature | Tier | Plan | Notes |
|---|---|---|---|
| **AI Priority Inbox** (auto-flag urgency + category) ★ | MVP | Free (limited) / Pro (full) | Cheap Gemini model on incoming mail via webhook |
| **AI Compose / "Write with AI"** (draft from one line, match your tone) ★ | V1 | Pro | |
| **AI Smart Reply** (1-click suggested responses) ★ | V1 | Pro | |
| **AI Thread Summarize / TL;DR long threads** ★ | V1 | Pro | |
| **"Catch me up" Daily Brief** (morning digest of what needs you) ★ | V1 | Pro | Scheduled via QStash/Cron |
| **Ask your inbox** (semantic Q&A: "what did Sarah say about the budget?") ★ | V2 | Pro | Embeddings + pgvector on Neon |
| **AI Agent Chat** (natural language → does anything) ★★ | V1 | Pro | Corsair MCP + Gemini tool-calling; flagship |
| **Auto-extract action items / tasks** from emails | V2 | Pro | |
| **Auto-draft replies waiting** (AI pre-drafts, you approve) ★ | V2 | Pro | |

### 2.4 Calendar & scheduling
| Feature | Tier | Plan | Notes |
|---|---|---|---|
| Day / week / month views, fast nav | MVP | Free | |
| Natural-language event creation ("lunch w/ Sam Fri 1pm") ★ | V1 | Pro | |
| Create event / send invite / update / delete, attendee chips | MVP | Free | `sendUpdates` handling |
| **Scheduling links / public booking page (Calendly-style)** ★★ | V1 | Pro | **Built-in virality** — each link is inbound marketing |
| **"Find a time"** across attendees' availability ★ | V2 | Pro | |
| One-keystroke "invite from this email" | V1 | Free | Pre-fills attendees from thread |
| Meeting prep cards (agenda + attendee context) | V2 | Pro | |
| Time-zone intelligence | V1 | Free | |

### 2.5 Search & organization
| Feature | Tier | Plan | Notes |
|---|---|---|---|
| Advanced search builder (from/to/subject/has:attachment/date) ★ | V1 | Free | Corsair search API + chips → Gmail syntax |
| Saved searches + recent searches | V1 | Free | |
| Semantic / natural-language search | V2 | Pro | shares embeddings with "Ask your inbox" |

### 2.6 Navigation & control surface
| Feature | Tier | Plan | Notes |
|---|---|---|---|
| **Command palette (`Cmd+K`)** — go anywhere, do anything ★ | MVP | Free | `cmdk` |
| **Global keyboard shortcuts** (C/E/R/J/K///G I/G C/?) ★ | MVP | Free | Superhuman-style |
| Interactive shortcut coaching / onboarding tutorial | V1 | Free | Drives the "aha" + retention |
| Web push notifications (smart: VIP/urgent only) | V2 | Free | |

### 2.7 Contacts / CRM-lite (attract sales & founders)
| Feature | Tier | Plan | Notes |
|---|---|---|---|
| Contact side-panel (history, last interactions, frequency) ★ | V2 | Pro | `contacts` table, derived from mail |
| VIP contacts (always prioritize) | V1 | Free | |
| Lightweight enrichment (company, social) | V2 | Pro | optional 3rd-party API |

### 2.8 Collaboration / Team (expansion revenue)
| Feature | Tier | Plan | Notes |
|---|---|---|---|
| Shared snippets / templates library | V2 | Team | |
| Comments / @mentions on threads (internal) | V2 | Team | |
| Delegate / assign emails | V2 | Team | |
| Shared inbox (team@) | V2 | Team | |
| Team analytics (response time, volume) | V2 | Team | |
| Admin, roles, SSO/SCIM | V2 | Team | |

### 2.9 Personalization & polish
| Feature | Tier | Plan | Notes |
|---|---|---|---|
| Dark/light + glassmorphic themes ★ | MVP | Free | |
| Custom keyboard shortcuts | V2 | Pro | |
| Inbox Zero celebration / streaks (gentle gamification) ★ | V1 | Free | Retention hook |
| Installable PWA (mobile-responsive) | V1 | Free | |

**Flagship demo trio (what every screenshot/video leads with):** ★★ **Agent Chat**, ★★ **Scheduling Links**, and ★ **Catch-me-up Daily Brief** — because they're memorable, screenshot-able, and uniquely "AI command center."

### 2.10 Platform: Teams, Helpdesk, Automation & API (org pivot — added 2026-06-14)
| Feature | Tier | Plan | Notes |
|---|---|---|---|
| **Organizations / workspaces** (solo user = 1-person org) | V1 | All | New billing + data boundary; gate for everything below |
| **Team members + roles** (owner/admin/agent), email invites | V1 | Team | Per-seat billing |
| **Shared inbox** (connect `support@`, org-owned Corsair tenant) ★ | V1 | Team | Multiple agents triage one mailbox |
| **Support tickets / IDs** (`[GSN-####]` in subject, threaded, trackable) ★★ | V1 | Team | Queue, status, assignment, internal notes |
| **Automation engine** (trigger → condition → action: auto-reply, assign, label, webhook) ★★ | V1 | Team | Evaluated off the webhook via QStash; rule builder + run log |
| **Public API** (`/api/v1/*`, API keys + scopes + rate limits) ★ | V1 | Platform | Users integrate their own apps |
| **Outbound webhooks** (signed: `email.received`, `ticket.created/updated`) | V1 | Platform | Event push to user systems |
| **API docs site** (OpenAPI + `/docs` + quickstart + samples) | V1 | Free | Developer growth surface |
| **Bulk / mail-merge** (CSV or Sheet-link → variable map → throttled send) ★ | V1 | Pro/Team | CAN-SPAM: unsubscribe + suppression list; per-plan caps |

---

## 3. Current State Audit — verified 2026-06-14

> **Rewritten 2026-06-14 after a full code audit.** The repo is **far** beyond the original "plain demo." `tsc --noEmit` is clean and **36/36 vitest pass**. Backend is roughly **Phases 0–6 built**. The real problem is not missing features — it is that **the most monetizable features are implemented server-side but never surfaced in the UI** (value trapped one layer below the user).

### 3.1 Built and working (verified)
| Area | File(s) | Status |
|---|---|---|
| Bootstrap: full env schema, extracted dedupe helper, 8 test files | `src/env.js`, `src/server/lib/corsair-entities.ts`, `src/__tests__/*` | ✅ |
| Auth + per-user tenancy: NextAuth + Google (restricted scopes), `protectedProcedure`, per-user Corsair tenant provisioning | `src/server/auth.ts`, `corsair-setup.ts`, `api/trpc.ts` | ✅ tenant = user, real token provisioning |
| Gmail router: search/get/drafts/refresh/send + **reply/archive/markRead**, cache-first + rate-limited + typed 401 reconnect | `routers/gmail.ts`, `redis.ts`, `ratelimit.ts` | ✅ |
| Calendar router: search/refresh/create/invite/**delete** | `routers/calendar.ts` | ✅ |
| Premium UI: 3-pane dark shell, ⌘K palette, shortcuts (J/K/E/C/R/G·I/?), DOMPurify, settings | `_components/dashboard.tsx`, `command-palette.tsx`, `_hooks/use-shortcuts.ts` | ✅ Superhuman-grade |
| AI Agent: streamed Gemini tool-calling with propose/confirm gates, transcript persisted | `api/agent/chat/route.ts`, `routers/agent.ts` | ✅ |
| AI suite: compose / smart-reply / summarize / daily-brief (all premium-gated) | `routers/ai.ts` | ✅ backend |
| Billing: Stripe Checkout/Portal + **signature-verified webhook**, 14-day trial, plan-gate | `routers/billing.ts`, `api/stripe/webhook`, `plan-gate.ts` | ✅ backend |
| Scheduling availability engine + public booking page | `routers/scheduling.ts`, `app/book/[slug]` | ✅ public side |
| Webhook ingest: idempotency (`webhook_events`), Gemini priority classify, contact upsert, realtime emit | `api/webhooks/route.ts` | ⚠️ works; see 3.3 |
| Growth/legal: referrals, /privacy, /terms, data export, account delete, analytics | `routers/referral.ts`, `routers/auth.ts`, `lib/analytics.ts` | ✅ |

### 3.2 The real gap — value trapped in the backend (UI not wired)
| Built backend | UI surface | Impact |
|---|---|---|
| `ai.*` (compose/smartReply/summarize/dailyBrief) | **0 buttons** | The #1 reason to switch is invisible |
| `scheduling.createLink/listLinks/toggleLink` (★★ viral loop) | **0** (only public `/book/[slug]`) | Users **cannot create** a link |
| `template.*` (snippets CRUD) | **0** | Hidden |
| `contacts.listContacts/toggleVip` | **0** | Hidden |
| `email_meta` AI priority | **never read back into inbox** | No Split Inbox / badges despite AI doing the work |
| Snooze / Send-Later / Follow-ups | schema + job runner only | **No create procedure, no cron → non-functional end-to-end** |

### 3.3 Production blockers (must fix before paid traffic)
- **Realtime = in-memory Node `EventEmitter`** (`event-emitter.ts`) → breaks on Vercel serverless (multi-instance). Needs Pusher/Ably or Upstash.
- **No cron / queue trigger** → `api/jobs/process` exists but nothing calls it; snooze/send-later/brief never fire.
- **Webhook tenant from `?tenantId=` query param, no signature** → spoofable; AI classify runs inline blocking the 200.
- **Checkout passes `price_mock_premium`**; `billing.ts:34` seeds Stripe customerId from `referredByCode` (bug).
- **`tenant.ts` falls back to `'dev'`** instead of throwing on missing tenant (footgun).
- **No Sentry / structured logging / CI gate**; `GEMINI/UPSTASH/STRIPE` env all optional → silent degradation.
- **Google OAuth verification + CASA not started** — the GA gate (long lead).

---

## 4. Gap Analysis: Demo → Lovable Paid Product

Three tracks; a paid launch needs all three, not just features.

- **Track A — Product depth:** the feature catalog above (triage, AI, scheduling, search, palette).
- **Track B — "Actually payable":** per-user auth + own Corsair tenant; Stripe subscriptions + gating; **Google OAuth verification + CASA** (the real launch gate, §8); reliability (rate limiting, idempotent webhooks, error tracking).
- **Track C — Growth:** onboarding "aha," referrals, viral scheduling links, lifecycle email, analytics.

**Sequencing principle:** auth/multi-tenancy lands **first** (every feature needs to know *who* the user is and read *their* tenant), compliance starts **early** (long lead time), and we ship a lovable private beta before we ship billing.

---

## 5. Target Architecture

```
Browser (Next.js RSC + React 19 client)
  │  session cookie (NextAuth)
  ▼
tRPC API ── protectedProcedure (requires session)
  │   ctx.user   → app user (Neon)
  │   ctx.tenant → corsair.withTenant(user.corsairTenantId)   // per-user isolation
  │   ctx.redis  → Upstash (cache + rate limit)
  │
  ├─ Reads  → tenant.<plugin>.db.*    (Corsair Postgres cache on Neon)
  ├─ Writes → tenant.<plugin>.api.*   (live Google via Corsair)
  ├─ AI     → Gemini (priority, compose, summarize, agent), cached in Upstash
  └─ Jobs   → QStash (snooze wake, send-later, follow-up, daily brief)
  ▲
  │ realtime push (Pusher/Ably channel keyed by userId)
  │
Webhooks /api/webhooks (Corsair) → verify+idempotent → update cache
   → resolve tenant→user → enqueue AI priority → publish realtime event
Stripe   /api/stripe/webhook → entitlements
```

**Principles carried from the working code:** Reads = DB cache, Writes = live API; dedupe by `entity_id` keeping latest `updated_at` (extract the duplicated helper into `src/server/lib/corsair-entities.ts`); **every Corsair call tenant-scoped from the session** — `getTenant(ctx)`, never `process.env.TENANT_ID`.

**The critical change:** `tenant = user`. Each app user gets a stable `corsairTenantId`; their Google OAuth tokens are provisioned into *their* tenant; no procedure can address another tenant.

---

## 6. Data Model (Drizzle / Neon)

Keep Corsair-managed tables (`corsair_integrations/accounts/entities/events`) untouched. Add app tables in `src/server/db/app-schema.ts`:

```ts
users           { id(cuid pk), email, name, image, timezone, createdAt, updatedAt,
                  corsairTenantId(unique), gmailConnected, calendarConnected,
                  onboardingCompletedAt, referralCode(unique), referredByCode }
// NextAuth: accounts, sessions, verificationTokens (Drizzle adapter)

connected_accounts { id, userId, provider, googleEmail, corsairTenantId, // multi-account
                     isPrimary, gmailConnected, calendarConnected, createdAt }

subscriptions   { id, userId, stripeCustomerId, stripeSubscriptionId,
                  plan(free|pro|team), status(trialing|active|past_due|canceled),
                  currentPeriodEnd, cancelAtPeriodEnd, seats, createdAt, updatedAt }

email_meta      { id, userId, gmailMessageId, threadId,
                  priority(urgent|high|normal|low), priorityReason, category,
                  isSnoozed, snoozeUntil, isPinned, isVipSender, readAt,
                  createdAt, updatedAt, unique(userId,gmailMessageId) }

send_queue      { id, userId, rawBase64Url, threadId, sendAt, status, createdAt } // send-later
follow_ups      { id, userId, threadId, sentMessageId, remindAt, reason, status }
templates       { id, userId, name, shortcut, subject, body, variables(jsonb),
                  isShared, createdAt, updatedAt }            // snippets
saved_searches  { id, userId, name, query, createdAt }

scheduling_links{ id, userId, slug(unique), title, durationMins, bufferMins,
                  availability(jsonb), isActive, createdAt }   // ★ viral
bookings        { id, schedulingLinkId, inviteeEmail, inviteeName, start, end,
                  calendarEventId, createdAt }

contacts        { id, userId, email, name, lastInteractionAt, interactionCount,
                  isVip, enrichment(jsonb), unique(userId,email) }

agent_messages  { id, userId, role(user|assistant|tool), content(jsonb),
                  toolCalls(jsonb), createdAt }
referrals       { id, referrerUserId, code, referredEmail, status, rewardGrantedAt }
audit_log       { id, userId, action, metadata(jsonb), ip, createdAt }
webhook_events  { id(provider event id pk), provider, receivedAt, processedAt,
                  status, payloadHash }                        // idempotency
// V2: email_embeddings (pgvector) for "Ask your inbox" + semantic search
```

**Privacy by design:** store **metadata, not bodies** in our tables; bodies live only in Corsair's cache. Smaller breach surface, simpler deletion. Migrations via `pnpm db:generate` → review SQL → `pnpm db:migrate` (never `db:push` to prod).

### 6.1 Platform / org / helpdesk / API tables (org pivot — added 2026-06-14)

```ts
organizations    { id, name, slug(unique), ownerUserId, plan, stripeCustomerId, seats, createdAt }
org_members      { id, orgId, userId, role(owner|admin|agent), status(active|invited),
                   invitedEmail, createdAt, unique(orgId,userId) }
shared_mailboxes { id, orgId, address, corsairTenantId, connectedByUserId, createdAt } // org-owned tenant

tickets          { id, orgId, publicId(unique, e.g. GSN-1042), subject, requesterEmail, threadId,
                   status(open|pending|solved|closed), priority, assigneeUserId, mailboxId,
                   firstResponseAt, resolvedAt, createdAt, updatedAt }
ticket_events    { id, ticketId, authorUserId, type(reply|note|status|assign),
                   body, isInternal, createdAt }

automations      { id, orgId, name, isEnabled, trigger(jsonb), actions(jsonb ordered),
                   runOrder, createdAt }
automation_runs  { id, automationId, ticketId, status, log(jsonb), createdAt }

api_keys         { id, orgId, name, prefix, hashedKey, scopes(jsonb), lastUsedAt, revokedAt, createdAt }
api_webhooks     { id, orgId, url, secret, events(jsonb), isActive, createdAt }
api_request_log  { id, orgId, keyId, route, status, createdAt }

bulk_campaigns   { id, orgId, userId, name, templateId, source(csv|sheet), status,
                   total, sent, failed, scheduledAt, createdAt }
bulk_recipients  { id, campaignId, email, vars(jsonb), status, sentAt }
suppressions     { id, orgId, email, reason, createdAt, unique(orgId,email) }
```

**Tenancy migration:** `subscriptions` move to **org-scoped, seat-based** for Team (Pro stays per-user). On migration, each existing user gets a 1-person org (`ownerUserId = user.id`); their personal `corsairTenantId` stays; shared mailboxes get their own org-owned tenant. No procedure may address a ticket/automation/key outside the caller's org.

---

## 7. Phased Roadmap

Each phase: **Goal → Tasks → Acceptance.** Ordered by dependency. P0–P4 = private beta + paid GA; P5–P8 = differentiation; P9–P10 = growth + hardening. Feature tags map back to §2.

> **Status (2026-06-14):** P0–P6 are largely **built** (see §3). Remaining individual-product work is repackaged as **Surfacing Sprints S1–S3** (below §7's original phases). The **org pivot adds P11–P15 + P9.5**. Critical path to a sellable team product: **S1 → S3 → P11 → P12 → P13**; API (P14) and bulk (P15) branch off P11 in parallel.

### Phase 0 — Repo bootstrap & foundations (1 day)
**Goal:** clean, safe foundation for a real product.
- [ ] `git init`, add a fresh remote, first commit; confirm `.gitignore` covers `.env`, `.DS_Store`, `node_modules`, `.next`.
- [ ] Rename product: `package.json` `google-demo`→`gusion-mail`; update `README.md`, `<title>`, layout metadata, favicon.
- [ ] Expand `src/env.js` (full validated schema): `CORSAIR_KEK`, `GOOGLE_CLIENT_ID/SECRET`, `AUTH_SECRET`, `AUTH_URL`, `GEMINI_API_KEY`, `UPSTASH_REDIS_REST_URL/TOKEN`, `QSTASH_TOKEN`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CORSAIR_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `SENTRY_DSN`, realtime keys. Mirror in `.env.example`.
- [ ] Extract `dedupeByEntityId` + sort/map helpers into `src/server/lib/corsair-entities.ts` (dedupe the duplication in both routers).
- [ ] Add `vitest` + a couple of unit tests; wire `pnpm check` for CI.

**Acceptance:** fresh repo committed; `pnpm check` passes; app boots with validated env; no duplicated dedupe logic.

### Phase 1 — Auth & per-user multi-tenancy (2–3 days) — **HIGHEST PRIORITY**
**Goal:** real users sign in; each gets an isolated Corsair tenant; every procedure is authorized.
- [ ] NextAuth (Auth.js v5) + Drizzle adapter, Google sign-in. Add `users`/NextAuth tables.
- [ ] On first sign-in: generate `corsairTenantId = "user_"+cuid` + a `referralCode`; persist.
- [ ] tRPC context resolves session → `ctx.user`; add `protectedProcedure`; migrate **all** gmail/calendar procedures off `publicProcedure`.
- [ ] `getTenant(ctx)` → `corsair.withTenant(ctx.user.corsairTenantId)`; remove `TENANT_ID` from request paths.
- [ ] **Per-user Google connection:** onboarding "Connect Gmail/Calendar" that provisions the user's Google tokens into *their* tenant (confirm programmatic per-tenant OAuth via Corsair docs / `pnpm corsair list`). Set `gmailConnected/calendarConnected`.
- [ ] Middleware gating `/app/**`; `audit_log` on connect/disconnect.
- [ ] **Cross-tenant denial test** (a procedure cannot read another tenant).

**Acceptance:** two Google accounts sign up, each sees only their data; coercing another tenant fails; sign-out clears session.

### Phase 2 — Reliability layer + router hardening (2 days)
**Goal:** make the existing routers production-grade and put Upstash in front.
- [ ] `src/server/lib/redis.ts` (Upstash). Cache hot reads (inbox load, week view) with per-user keys + short TTL; invalidate on writes/webhooks. Target sub-100ms warm.
- [ ] Rate limiting (`@upstash/ratelimit`): per-user on mutations + AI; strict anon limit on `/api/webhooks` and auth.
- [ ] Typed error handling: map Corsair/Google 401(reauth)/403(scope)/429(rate) to actionable UI errors + "Reconnect Google" recovery.
- [ ] New procedures the UX needs: `replyToEmail` (thread-aware `In-Reply-To`/`References`), `archiveEmail`, `markRead` (Gmail `messages.modify`), calendar `updateEvent`/`deleteEvent`.
- [ ] Verify every endpoint with `pnpm corsair schema <endpoint>` before coding.

**Acceptance:** warm reads cached + correctly invalidated; abuse throttled with clear errors; expired tokens prompt reconnect; reply/archive/markRead/update/delete work live.

### Phase 3 — Premium UI, keyboard-first UX & command palette (5–6 days)
**Goal:** the Superhuman-grade experience — the core differentiator. (Features: §2.1, §2.6, §2.9 dark/streaks, §2.4 calendar views.)
- [ ] Replace `globals.css` with a Tailwind v4 design system (dark + glass tokens); install `framer-motion`, `sonner`.
- [ ] App shell `/app`: three-pane (sidebar · list · reading), responsive → single pane mobile (PWA-installable).
- [ ] **Split Inbox / smart views**, virtualized list, density toggle, priority badges, unread styling, optimistic archive/read, **Undo Send**.
- [ ] Reading pane: threaded, **sanitized** HTML (DOMPurify), quick reply, attachments.
- [ ] Compose sheet: To/Cc/Bcc, snippets, `Cmd+Enter` send, schedule-send entry point.
- [ ] Calendar: day/week/month, create/invite/update/delete, attendee chips, "invite from email."
- [ ] **Command palette** (`cmdk`, `Cmd+K`) + **global shortcuts** (`src/app/_hooks/use-shortcuts.ts`): `C/R/E/J/K/Enter/U//`, `G I`, `G C`, `Cmd+K`, `?` help overlay. Respect input focus.
- [ ] Toasts on every mutation; skeletons everywhere; a11y pass (focus rings, ARIA, keyboard reachability).
- [ ] Inbox-Zero celebration + streak.

**Acceptance:** full inbox triage without a mouse; `Cmd+K` does everything; premium dark UI; every mutation has optimistic UI + toast + rollback.

### Phase 4 — Billing & monetization (Stripe) (2–3 days) — **REQUIRED FOR "PAYABLE"**
**Goal:** users subscribe, pay, and are gated by plan. (See §9.)
- [ ] Stripe Products/Prices; **Checkout + Customer Portal** (low PCI surface).
- [ ] `billingRouter`: `createCheckoutSession`, `createPortalSession`, `getSubscription`.
- [ ] `/api/stripe/webhook` (raw body, signature-verified) → upsert `subscriptions` on checkout/subscription/`payment_failed`. **Entitlement source of truth.**
- [ ] 14-day Pro trial; `requirePlan(ctx,'pro')` gating helper. Free = basic triage with limits; Pro = AI + scheduling + power features.
- [ ] Billing UI: pricing page, in-app Upgrade CTA, manage (portal), past-due banner.

**Acceptance:** test-mode Checkout flips user to `active`; gated features unlock; portal cancel downgrades; `payment_failed` shows banner.

### Phase 5 — AI agent chat (Gemini + Corsair MCP) (3–4 days) — ★★ flagship
**Goal:** "Invite dev@corsair.dev Thursday 9am and email them I'm looking forward to it" → done. (Feature §2.3 Agent.)
- [ ] `ai` + `@ai-sdk/google`. `agentRouter.chat` (streamed) with tools mapping to existing mutations (`sendEmail`, `replyToEmail`, `createCalendarEvent`, `sendInvite`, `searchEmails`, `listEvents`…). **Server executes real Corsair calls under the user's tenant**; re-validate every tool arg with Zod.
- [ ] **Corsair MCP** exposes the user's integrations to the agent; keep a server-side tool allow-list.
- [ ] **Confirmation gate** (preview before send/create) unless auto-run enabled; log every action to `audit_log`.
- [ ] Timezone-aware relative dates ("next Thursday 9am"). Persist transcript (`agent_messages`); streaming chat UI with tool-call cards + confirm/cancel.

**Acceptance:** the canonical multi-step prompt creates the invite **and** the email in one turn, with confirmation, scoped to the user, fully logged.

### Phase 6 — Realtime + AI priority inbox (webhooks) (2–3 days)
**Goal:** new mail/events appear instantly, pre-prioritized. (Features §2.3 priority, realtime.)
- [ ] Harden `/api/webhooks`: resolve real tenant from payload (drop hardcoded `'dev'`); verify signature; idempotency via `webhook_events`; fast 200 + async work.
- [ ] Tenant→user resolution; **AI priority classification** on new mail (cheap Gemini → `{priority,reason,category}`) → upsert `email_meta`; cache prompt→result in Upstash; never block ingestion (offload to QStash if heavy).
- [ ] **Realtime push:** per-user channel (Pusher/Ably recommended for serverless; SSE acceptable MVP) → client invalidates/prepends. Invalidate Upstash inbox cache on relevant events.

**Acceptance:** a test email appears in the open UI within seconds, already badged, no refresh; replaying a webhook is a no-op.

### Phase 7 — AI productivity suite + scheduling links (4–5 days)
**Goal:** the headline "wow" features that sell the AI command center. (Features §2.2, §2.3 compose/summarize/brief, §2.4 scheduling links.)
- [ ] **AI Compose / Smart Reply / Summarize** (Gemini): compose from prompt + tone match; 1-click replies; thread TL;DR. Cache + rate-limit per plan.
- [ ] **Snooze**, **Send Later** (`send_queue` + QStash), **Follow-up nudges** (`follow_ups`).
- [ ] **Snippets/templates** with variable expansion.
- [ ] **"Catch me up" Daily Brief** (QStash/Cron → Gemini digest → in-app + optional email).
- [ ] **Scheduling links / public booking page** ★★: `scheduling_links` + public `/book/[slug]` route; availability from calendar; booking creates event + invite (`bookings`). This is the **viral loop** (§10).

**Acceptance:** AI compose/reply/summarize produce useful output; snooze/send-later/follow-up fire on schedule; a public link lets a stranger book a real calendar slot.

### Phase 8 — Advanced search + contacts (2–3 days)
**Goal:** great search and sender context. (Features §2.5, §2.7.)
- [ ] Search builder chips → Gmail syntax + Corsair `db.messages.search`; saved/recent searches; `/`-to-search; results in palette; debounced, highlighted.
- [ ] Contacts side-panel (history/frequency from mail), VIP flagging.
- [ ] (V2 spike) "Ask your inbox" semantic search via embeddings + pgvector.

**Acceptance:** chip-built advanced queries return fast correct results; opening a thread shows sender history; VIPs always prioritized.

### Phase 9 — Growth, onboarding & lifecycle (2–3 days, overlaps GA)
**Goal:** turn signups into retained, paying, referring users. (See §10.)
- [ ] Onboarding to "aha" in <2 min: connect Google → first AI brief → first agent action; interactive shortcut tutorial.
- [ ] **Referral program** (`referrals`): give/get free months; referral link off `users.referralCode`.
- [ ] Optional subtle "Sent with Gusion" signature toggle + branded scheduling pages (viral surfaces).
- [ ] Product analytics (PostHog) for activation/retention funnels; lifecycle email (welcome, trial-ending, win-back).

**Acceptance:** new user reaches a wow moment in their first session; referral grants a reward end-to-end; activation funnel is measurable.

### Phase 10 — Security, compliance & launch hardening (parallel; **gates GA** — see §8 & §12)
- [ ] **Google OAuth verification + CASA** (kick off in Phase 1 — long lead).
- [ ] Privacy Policy, ToS; in-app **data export + account deletion** (purges app data + Corsair tenant + revokes tokens).
- [ ] Security headers (CSP/HSTS), DOMPurify on email HTML, dependency + secret scanning in CI, `CORSAIR_KEK` in secrets manager only.
- [ ] Sentry (server+client), structured logging (no bodies/tokens), health check, uptime monitor, Neon backup + restore test.
- [ ] Tests: Vitest (email encode/decode, dedupe, priority shape, gating) + Playwright E2E (sign-in→connect→send→archive; agent prompt→confirm; Checkout test). CI green gate before prod deploy.

---

### Surfacing Sprints — finish the individual product (mostly UI wiring over built backend)

**S1 — Make the magic visible (4–5d).** Wire `ai.aiCompose` into compose ("✨ Write with AI"), `aiSmartReply` (1-click) + `aiSummarize` (TL;DR) into the reading pane, surface `aiDailyBrief` as the inbox landing card, and make **Split Inbox real** (join `email_meta` → Important/Other/VIP tabs + priority badges). *Acceptance: each AI action returns <3s, gated to trial/Pro; inbox shows AI priority.*

**S2 — Complete viral loop + power features (4–5d).** Scheduling-link management UI (`createLink/listLinks/toggleLink`); add missing **snooze / send-later / follow-up create procedures**; real **Undo Send** (replace the fake toast); templates + contacts/VIP panels. *Acceptance: a user creates a public link end-to-end; snooze/send-later actually fire (needs S3 queue).*

**S3 — Productionize (3–4d).** Replace in-memory realtime with **Pusher/Ably (or Upstash)** keyed by userId; stand up the **QStash queue + Vercel Cron** and wire `api/jobs/process`; **verify webhook signature** + resolve tenant from payload (drop `?tenantId=`) + offload AI classify off the 200 path; create real Stripe Product/Price (replace `price_mock_premium`) and fix the `billing.ts` customerId bug. *Acceptance: jobs fire on schedule; realtime works across instances; live Checkout flips entitlement.*

---

### Platform Phases (org pivot — added 2026-06-14)

**Queue & rate-limiting architecture (decided 2026-06-14):** a thin `Queue` abstraction with **QStash as the default driver** (serverless-native: snooze/send-later/brief, automation eval, webhook delivery with retries). **BullMQ optional** as a dedicated-worker driver for high-throughput bulk send *only if* needed — BullMQ requires an always-on worker host (not Vercel functions) + a TCP Redis. Per-key / per-plan / per-mailbox limits via **Upstash ratelimit** (already installed).

### Phase 11 — Org foundation (4–5 days) — **GATE for the platform**
**Goal:** organizations are the billing + data boundary; solo user = 1-person org.
- [ ] `organizations` / `org_members` schema + migration; backfill each user into a 1-person org.
- [ ] Org-scoped tRPC context (`ctx.org`, `requireRole`); move Team `subscriptions` to per-seat.
- [ ] Invite-by-email flow + role management UI; `audit_log` on member/role changes.
- [ ] **Cross-org denial test** (no procedure addresses another org's tickets/keys/automations).

**Acceptance:** two orgs cannot see each other's data; inviting a member consumes a seat; solo users unaffected.

### Phase 12 — Shared inbox + Support tickets (5–6 days) — ★★
**Goal:** a team triages `support@` with trackable IDs.
- [ ] Connect a shared mailbox (org-owned Corsair tenant); ingest into a shared queue.
- [ ] `publicId` generation (`GSN-####`) embedded in subject for threading + customer tracking.
- [ ] Ticket queue UI (filter by status/assignee); ticket detail: reply, internal note, status, assignment.
- [ ] First-response / resolution timestamps for SLA later; optional "X is viewing" collision hint.

**Acceptance:** inbound to `support@` opens a ticket with an ID; assigning routes it; the requester's reply threads back to the same ID.

### Phase 13 — Automation engine (4–5 days) — ★★
**Goal:** "when an email hits `support@` matching X, auto-reply from template + assign + tag."
- [ ] Trigger/condition/action model; evaluate via QStash off the webhook (never block ingest).
- [ ] Actions: open ticket, assign, auto-reply (template), add label, fire outbound webhook.
- [ ] Rule-builder UI + `automation_runs` log; per-org rate caps to prevent loops/storms.

**Acceptance:** a configured rule auto-replies with the right ID + assignee within seconds; every run logged; disabling stops it.

### Phase 14 — Public API + docs (5–6 days)
**Goal:** users integrate their own apps.
- [ ] `/api/v1/*` (messages send/list, tickets CRUD, automations trigger, contacts) with **API-key auth** (hashed, prefixed), per-key **scopes** + **rate limits**.
- [ ] Signed **outbound webhooks** (`email.received`, `ticket.created/updated`) with retries (QStash) + delivery log.
- [ ] **OpenAPI spec** + `/docs` (Scalar/Redoc) + quickstart + code samples; key management UI.

**Acceptance:** an external curl with a scoped key sends mail + creates a ticket; revoking the key blocks it; a webhook delivers + retries on failure.

### Phase 15 — Bulk / Sheets mail-merge (4–5 days)
**Goal:** personalized mail in bulk (decided: **CSV / Sheet-link**, no new OAuth scope).
- [ ] Upload CSV **or** paste a shared Google Sheet link → parse rows → map columns to template variables → preview.
- [ ] Throttled queued send (`bulk_campaigns`/`bulk_recipients` + queue) under Gmail limits + per-plan caps.
- [ ] **Unsubscribe link + suppression list** (CAN-SPAM / Google bulk-sender compliance); per-campaign stats.

**Acceptance:** a 50-row merge sends personalized mail, respects caps + suppressions, and reports sent/failed.

### Phase 9.5 — Seamless onboarding (2–3 days, woven across)
**Goal:** wow in <60s.
- [ ] Guided first run: Google sign-in → auto-provision (exists) → Daily Brief + one AI action → choose **individual vs team**.
- [ ] If team: optional connect `support@` + invite a teammate; if individual: optional CSV import.
- [ ] Progressive disclosure, empty states with one-click sample data, completion checklist.

**Acceptance:** a brand-new user reaches a wow moment + an activated state in their first session, on either path.

---

## 8. Security, Privacy & Compliance — the real launch gate

> **Read this before optimizing for ship date.** The original PRD omits it; it's the thing most likely to delay a paid public launch.

- **Google OAuth verification + CASA (mandatory, long lead):** reading users' Gmail needs **restricted scopes** (`gmail.modify`, `gmail.send`, etc.). For external users Google requires app verification **and** an annual third-party **CASA security assessment** (has cost + weeks of lead). **Start in Phase 1.** Until verified you're capped at **Testing mode (≤100 users)** — fine for private beta, not paid public launch. Request the **minimum** scopes.
- **Data protection:** Corsair caches email **bodies** in Neon → sensitive personal data. Encryption at rest (Neon), restricted DB access, documented retention. We store **metadata not bodies** in our tables to shrink blast radius. `CORSAIR_KEK` is a top-tier secret (secrets manager only, rotatable, never client/logs).
- **Account deletion** purges app data **and** the Corsair tenant **and** revokes Google tokens.
- **App security:** all `protectedProcedure` + per-tenant scoping; rate limiting (auth/webhooks/AI); verify Stripe + Corsair webhook signatures + idempotency; DOMPurify on rendered email HTML; CSP/HSTS; no secrets in `NEXT_PUBLIC_*`.
- **Read-tracking / open-tracking** (§2.2 read statuses) is privacy-sensitive: opt-in, disclosed in the privacy policy, and respect recipient norms.
- **Legal before charging:** Privacy Policy, ToS, refund terms, basic DPA + cookie/consent for EU.

---

## 9. Monetization & Pricing (starting point)

| Plan | Suggested | Includes | Gating |
|---|---|---|---|
| **Free** | $0 | 1 account, split inbox, calendar, search, palette + shortcuts, snooze, VIP, limited AI priority, API docs | No agent, no AI compose/summarize/brief, no scheduling links, no send-later |
| **Pro** | ~$20/mo or $192/yr | Everything individual: AI agent, AI compose/reply/summarize, daily brief, scheduling links, send-later, follow-ups, snippets, multi-account, advanced search, **bulk mail-merge (capped)** | Full individual |
| **Team** | ~$25/seat/mo | Pro + **shared inbox, support tickets/IDs, assignment + internal notes, automation engine**, shared snippets, analytics, admin | Per-seat, org-scoped |
| **Platform add-on** | usage / tier | **Public API access, API keys + scopes, outbound webhooks, higher bulk caps** | Per-org, metered |

- **14-day Pro trial** (card-required recommended for a prosumer tool). Stripe Checkout + Portal.
- **Cost control:** AI is the variable cost — cheapest Gemini model for priority/classification, aggressive Upstash caching, per-plan rate limits on agent turns + compose.

---

## 10. Growth, Virality & Go-To-Market

- **Built-in viral loops:**
  1. **Public scheduling links** — every shared `/book/[slug]` exposes a non-user to the product (Calendly's growth engine).
  2. **Optional "Sent with Gusion" signature** — lightweight, user-controlled.
  3. **Referral program** — give a month / get a month.
- **Activation:** onboarding must hit a wow moment fast — connect Google → instant "Catch me up" brief → one agent action. Interactive shortcut tutorial builds the habit.
- **Retention:** Inbox-Zero celebration/streaks, daily brief (a reason to return each morning), smart notifications.
- **Channels:** launch to founder/dev communities (Product Hunt, X, HN, Show HN), short demo video leading with the **flagship trio** (agent, scheduling, daily brief), a "Superhuman + AI for 1/3 the price" angle.
- **Measurement (PostHog):** activation = connected + first AI action; retention = D1/D7/D30; funnel from signup → trial → paid; referral K-factor.

---

## 11. Testing & QA
- **Unit (Vitest):** `email.ts` encode/decode/MIME, `dedupeByEntityId`, week filtering, priority-classifier output shape, plan-gating, scheduling availability math.
- **Integration:** tRPC routers vs a dev Corsair tenant; webhook idempotency; QStash job handlers.
- **E2E (Playwright):** sign-in → connect → list → reply → archive; compose → send → undo; agent prompt → confirm → invite+email; Checkout (test) → entitlement; public booking → real event.
- **Manual matrix:** token-expiry/reconnect, empty states, rate-limit errors, mobile/PWA, keyboard-only triage, screen reader.
- **Gate:** `pnpm check` + unit + critical E2E green in CI before any prod deploy.

## 12. Observability & SRE
- **Errors:** Sentry (server+client), release-tagged, source maps.
- **Logs:** structured JSON with `requestId`+`userId`; never log bodies/tokens; remove demo `console.log` in `trpc.ts`/webhook.
- **Metrics/alerts:** webhook failure rate, AI latency/cost/token spend, cache hit ratio, Stripe webhook failures, Google 401/403/429 rates, QStash job failures.
- **Runbook:** recovery for expired Google tokens, webhook backlog, missed Stripe webhook, Neon capacity, Upstash/QStash limits.
- **Backups:** Neon PITR on + one tested restore.

## 13. Deployment & Infrastructure
- **Host:** Vercel; all `env.js` vars per environment (Preview vs Prod).
- **DB:** Neon branches per env; `pnpm db:migrate` in deploy pipeline (never `db:push` to prod).
- **Webhooks:** dev via ngrok → `/api/webhooks` (README); prod uses Vercel URL — re-run Corsair webhook auth for prod; register Stripe webhook for prod.
- **Background jobs:** Upstash QStash (snooze, send-later, follow-up, daily brief) + Vercel Cron as needed.
- **Secrets:** Vercel encrypted env / secrets manager; `CORSAIR_KEK`, `STRIPE_SECRET_KEY`, `*_WEBHOOK_SECRET` production-critical.

## 14. Risk Register
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Google verification/CASA delays GA | High | High | Start Phase 1; minimize scopes; private beta in Testing mode meanwhile |
| Per-user Corsair OAuth provisioning is non-trivial | Med | High | De-risk in a Phase 1 spike; confirm programmatic per-tenant auth with Corsair before building UI |
| AI cost runaway (priority + agent + compose) | Med | Med | Cheapest model for classification, Upstash caching, per-plan limits |
| Email-body XSS via rendered HTML | Med | High | DOMPurify + CSP |
| Webhook duplicates/replays corrupt state | Med | Med | `webhook_events` idempotency + signature verify |
| Token expiry breaks UX silently | High | Med | Typed reauth error + "Reconnect Google" flow |
| Serverless realtime flakiness | Med | Med | Managed Pusher/Ably in prod |
| Single hardcoded tenant leaks across users | — | Critical | Phase 1 derives tenant from session + cross-tenant denial test |
| Open-tracking backlash / deliverability | Low | Med | Opt-in + disclosed; default off |

## 15. Milestones & Timeline (indicative, single dev)
- **M1 — Private Beta:** P0–P2 + start Google verification. ~1.5 wks. → users sign in, connect their Gmail, triage safely (Testing mode).
- **M2 — Lovable UX:** P3. ~1 wk. → feels like Superhuman.
- **M3 — Payable:** P4 + legal subset. ~3–4 days. → Stripe live.
- **M4 — AI command center:** P5–P6. ~1.5 wks. → agent + realtime priority.
- **M5 — Wow suite:** P7–P8. ~1.5 wks. → compose/summarize/brief + scheduling links + search.
- **M6 — GA:** P9–P10 + verification/CASA complete. → public paid launch + growth loops.

## 16. Launch Checklist (Definition of Done)
- [ ] Two unrelated Google accounts sign up, connect, and **never** see each other's data (automated test proves it).
- [ ] All procedures `protectedProcedure`; `TENANT_ID` not used in request paths.
- [ ] Stripe Checkout → entitlement → gating works live; portal cancel downgrades.
- [ ] Google OAuth **verified**; CASA complete; minimum scopes only.
- [ ] Privacy Policy + ToS live; in-app data export + account deletion (incl. Corsair tenant purge + token revoke).
- [ ] Webhooks signature-verified + idempotent; realtime < a few seconds.
- [ ] Rate limiting on mutations/AI/webhooks/auth; Sentry capturing; no secrets in logs/client; CSP+HSTS.
- [ ] `pnpm check` + unit + critical E2E green in CI; Neon backup/restore tested.
- [ ] Email HTML sanitized; Undo Send works; keyboard-only triage works; PWA installs.
- [ ] Flagship trio demoable: agent chat, scheduling links, daily brief.

## 17. Open Decisions (call these early)

**Resolved 2026-06-14:** (1) Positioning → **two-layer** (prosumer wedge + team/platform expansion). (2) **Org-first** — Organization is the billing/data boundary now (solo = 1-person org). (3) Bulk/Sheets → **CSV / Sheet-link mail-merge** for v1 (no new OAuth scope; live Sheets sync deferred). (4) Queue → **QStash default, BullMQ optional** for bulk. (5) Build **all** new pillars (P11–P15). Auth → NextAuth (in use). Realtime → managed Pusher/Ably (S3). Items below remain open.

1. **Positioning:** prosumer-first + AI (plan's assumption, recommended) vs team-first. Affects sequencing of §2.8.
2. **Auth:** NextAuth (assumed) vs Clerk.
3. **Free trial:** card-required (recommended) vs no-card.
4. **Realtime:** Pusher/Ably (recommended) vs self-hosted SSE.
5. **AI SDK:** Vercel `ai` + `@ai-sdk/google` (recommended) vs `@google/genai` direct.
6. **Pricing:** confirm Pro price + the Free/Pro feature line.
7. **Open-tracking (read statuses):** ship it (opt-in) or skip for trust/deliverability?
8. **Scope minimization:** smallest Gmail/Calendar scope set covering send/archive/read/invite (drives CASA difficulty).
9. **Team plan timing:** GA or post-launch (recommended: defer).

---

### Appendix A — Corsair endpoint discipline (from AGENT_PROMPT.md)
Before any Corsair call: `pnpm corsair list` and `pnpm corsair schema <endpoint>`. **Reads → `*.db.*`, writes/sync → `*.api.*`.** Dedupe by `entity_id` (latest `updated_at`); always pass `timeMin`/`timeMax` to calendar; `raw` is base64url RFC 2822 (handled in `src/server/lib/email.ts`); `sendUpdates:'all'` to notify invitees.

### Appendix B — File-level change map
- `src/env.js` — full env schema (P0)
- `src/server/lib/corsair-entities.ts` — extracted dedupe/sort (P0)
- `src/server/auth.ts`, `src/server/db/app-schema.ts` — NextAuth + app tables (P1)
- `src/server/api/trpc.ts` — `protectedProcedure` + auth context (P1)
- `src/server/lib/tenant.ts` — `getTenant(ctx)` from session (P1)
- `src/server/lib/redis.ts` — Upstash cache + ratelimit (P2)
- `src/server/lib/qstash.ts` + `src/app/api/jobs/**` — scheduled jobs (P7)
- `src/server/api/routers/{gmail,calendar}.ts` — reply/archive/markRead/update/delete + caching (P2)
- `src/styles/globals.css`, `src/app/(app)/**`, `src/app/_components/**`, `src/app/_hooks/use-shortcuts.ts` — premium UI + palette + shortcuts (P3)
- `src/server/api/routers/billing.ts`, `src/app/api/stripe/webhook/route.ts` — Stripe (P4)
- `src/server/api/routers/agent.ts` + agent chat UI — Gemini + MCP (P5)
- `src/app/api/webhooks/route.ts`, realtime channel — harden + priority + push (P6)
- `src/server/api/routers/{ai,scheduling,search,contacts}.ts`, `src/app/book/[slug]/**` — wow suite (P7–P8)
- `src/server/api/routers/referral.ts`, analytics + onboarding — growth (P9)
