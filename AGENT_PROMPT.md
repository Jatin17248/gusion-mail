# Agent Prompt: Gmail + Google Calendar Demo (Corsair + tRPC)

Build a simple Next.js app with tRPC for listing, searching, drafting, and sending emails (Gmail) and calendar invites (Google Calendar). Wire everything through **Corsair** — do not call Google APIs directly.

---

## What is Corsair?

Corsair is an integration layer for third-party APIs. It provides:

- **`api`** — live calls to the external service (Gmail, Google Calendar, etc.)
- **`db`** — reads from Corsair's **local Postgres cache** of synced entities
- **Webhooks** — incoming events that update the cache when data changes
- **Multi-tenancy** — each tenant has its own OAuth tokens and cached data

Configure once in `src/server/corsair.ts`:

```typescript
import 'dotenv/config';
import { createCorsair } from 'corsair';
import { gmail } from '@corsair-dev/gmail';
import { googlecalendar } from '@corsair-dev/googlecalendar';
import { conn } from './db';

export const corsair = createCorsair({
  plugins: [gmail(), googlecalendar()],
  database: conn,
  kek: process.env.CORSAIR_KEK!,
  multiTenancy: true,
});
```

All tenant-scoped calls:

```typescript
corsair.withTenant(process.env.TENANT_ID ?? 'dev').gmail.api.threads.list(...)
corsair.withTenant(process.env.TENANT_ID ?? 'dev').gmail.db.messages.list(...)
```

---

## CLI: discover endpoints — don't guess

**Do not assume Corsair APIs.** Use the CLI:

```bash
pnpm corsair list                          # all live API endpoints
pnpm corsair list --type db                # cached DB entity types
pnpm corsair schema gmail.api.messages.send   # input/output for one endpoint
pnpm corsair schema gmail.db.messages.search  # filter fields for DB search
```

Notes:
- DB entities expose both `.list()` and `.search()` (even if only `.search` shows in `list --type db`)
- Write ops marked `[write]`; reads marked `[read]`

If unclear, ask — do not invent APIs.

---

## API vs DB: when to use which

| Use case | Use | Why |
|----------|-----|-----|
| List/search inbox on page load | `gmail.db.messages.list` / `.search` | Avoids rate limits |
| List calendar events for a week | `googlecalendar.db.events.list` / `.search` | Same |
| "Refresh from Gmail" button | `gmail.api.threads.list` | Syncs from Google into cache |
| "Refresh from Calendar" button | `googlecalendar.api.events.getMany` | Pass `timeMin`/`timeMax` for the week |
| Send email | `gmail.api.messages.send` | Write — live API |
| Create/send draft | `gmail.api.drafts.create` / `.send` | Write |
| Create event / send invite | `googlecalendar.api.events.create` | `sendUpdates: 'all'` notifies attendees |
| Read full email on click | `gmail.db.messages.findByEntityId` first, `gmail.api.messages.get` fallback | Cache first |

**Rule of thumb:** UI list reads → **DB**. User-initiated sync or any mutation → **API**.

---

## tRPC wiring pattern

```typescript
// src/server/lib/tenant.ts
export function getTenant() {
  return corsair.withTenant(process.env.TENANT_ID ?? 'dev');
}

// src/server/api/routers/gmail.ts
export const gmailRouter = createTRPCRouter({
  searchEmails: publicProcedure
    .input(z.object({ query: z.string(), limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const tenant = getTenant();
      const messages = input.query.trim()
        ? await tenant.gmail.db.messages.search({
            data: { snippet: { contains: input.query } },
            limit: input.limit,
          })
        : await tenant.gmail.db.messages.list({ limit: input.limit });
      return dedupeAndSort(messages);
    }),

  refreshInbox: publicProcedure.mutation(async () => {
    const tenant = getTenant();
    const result = await tenant.gmail.api.threads.list({ maxResults: 50 });
    return { synced: result.threads?.length ?? 0 };
  }),

  sendEmail: publicProcedure
    .input(z.object({ to: z.string().email(), subject: z.string(), body: z.string() }))
    .mutation(async ({ input }) => {
      const tenant = getTenant();
      const raw = encodeRawEmail(input); // base64url RFC 2822 — NOT plain text
      return tenant.gmail.api.messages.send({ raw });
    }),
});
```

Wire UI buttons to tRPC via `@trpc/react-query` (e.g. refresh → `api.gmail.refreshInbox.useMutation()`).

---

## One-time project setup

```bash
pnpm i corsair @corsair-dev/gmail @corsair-dev/googlecalendar @corsair-dev/cli
```

Google Cloud: create project, enable Gmail + Calendar APIs, create OAuth credentials.

```bash
pnpm corsair setup --gmail client_id=... client_secret=...
pnpm corsair setup --googlecalendar client_id=... client_secret=...
pnpm corsair auth --plugin=gmail --tenant=dev
pnpm corsair auth --plugin=googlecalendar --tenant=dev
pnpm corsair auth --plugin=gmail --webhooks
pnpm corsair auth --plugin=googlecalendar --webhooks
```

Expose localhost via ngrok → `/api/webhooks`.

```
DATABASE_URL=postgresql://...
CORSAIR_KEK=<base64 key>
TENANT_ID=dev
```

---

## Webhook handler

```typescript
import { processWebhook } from 'corsair';

const result = await processWebhook(corsair, headers, body, {
  tenantId: process.env.TENANT_ID ?? 'dev',
});
// return result.response or 404 if no handler matched
```

Webhooks keep the DB cache fresh without constant API polling.

---

## Gotchas

**Gmail**
- `messages.send` / `drafts.create` require `raw`: **base64url-encoded RFC 2822** (MIME with `\r\n`, then encode: `+`→`-`, `/`→`_`, strip `=`)
- `messages.get` with `format: 'full'` has nested `payload.parts`; recursively extract `text/plain`
- DB messages may already have parsed `subject`, `from`, `to`, `body` — prefer those

**Calendar**
- `events.getMany` without `timeMin` returns events from the beginning of time — always pass `timeMin`/`timeMax`
- `sendUpdates: 'none'` = save without notifying; `'all'` = send invites

**DB entities**
```typescript
{ id, entity_id, updated_at, data: { snippet, subject, from, summary, start, ... } }
```
- `entity_id` = external ID (Gmail message ID, event ID)
- Cache can have duplicate `entity_id` rows — dedupe by `entity_id`, keep latest `updated_at`
- Search filters use a `data` wrapper: `{ data: { subject: { contains: 'hello' } }, limit: 50 }`

---

## UI for this demo

Minimal, markdown-like, left-aligned:
- **Email:** inbox (newest first), search, click to read full message, compose + send/draft
- **Calendar:** week view with ←/→ navigation, search, create event, send invite
- Format dates ("Today, 3:45 PM"), parse `Name <email@example.com>`, linkify URLs

---

## Deliverables

1. tRPC routers: `gmail` (list, search, get, refresh, draft, send) and `calendar` (list by week, search, refresh, create, send invite)
2. Simple React UI wired to those routes
3. Webhook route at `/api/webhooks`
4. Tenant helper + email encoding utilities

Run `pnpm corsair list` and `pnpm corsair schema <endpoint>` before writing Corsair calls.