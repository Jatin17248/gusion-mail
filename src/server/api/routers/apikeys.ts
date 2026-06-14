import { z } from "zod";
import { createTRPCRouter, orgProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { apiKeys, outboundWebhooks, webhookDeliveryLogs } from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";

export const apiKeysRouter = createTRPCRouter({
  listKeys: orgProcedure.query(async ({ ctx }) => {
    return await db.query.apiKeys.findMany({
      where: eq(apiKeys.orgId, ctx.org.id),
      orderBy: [desc(apiKeys.createdAt)],
    });
  }),

  createKey: orgProcedure
    .input(
      z.object({
        name: z.string().min(1),
        scopes: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const rawKey = "gsn_live_" + crypto.randomBytes(24).toString("hex");
      const hashed = crypto.createHash("sha256").update(rawKey).digest("hex");

      const [newKey] = await db
        .insert(apiKeys)
        .values({
          orgId: ctx.org.id,
          name: input.name,
          keyPrefix: "gsn_live_",
          hashedKey: hashed,
          scopes: JSON.stringify(input.scopes),
          isActive: true,
        })
        .returning();

      return {
        ...newKey,
        rawKey, // Plain text key to be shown once
      };
    }),

  deleteKey: orgProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await db.query.apiKeys.findFirst({
        where: and(eq(apiKeys.id, input.id), eq(apiKeys.orgId, ctx.org.id)),
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "API key not found." });
      }

      await db.delete(apiKeys).where(eq(apiKeys.id, input.id));
      return { success: true };
    }),

  listWebhookSubscriptions: orgProcedure.query(async ({ ctx }) => {
    return await db.query.outboundWebhooks.findMany({
      where: eq(outboundWebhooks.orgId, ctx.org.id),
      orderBy: [desc(outboundWebhooks.createdAt)],
    });
  }),

  createWebhookSubscription: orgProcedure
    .input(
      z.object({
        url: z.string().url(),
        events: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const secret = "whsec_" + crypto.randomBytes(16).toString("hex");

      const [sub] = await db
        .insert(outboundWebhooks)
        .values({
          orgId: ctx.org.id,
          url: input.url,
          secret,
          events: JSON.stringify(input.events),
          isActive: true,
        })
        .returning();

      return sub;
    }),

  deleteWebhookSubscription: orgProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await db.query.outboundWebhooks.findFirst({
        where: and(eq(outboundWebhooks.id, input.id), eq(outboundWebhooks.orgId, ctx.org.id)),
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Webhook subscription not found." });
      }

      await db.delete(outboundWebhooks).where(eq(outboundWebhooks.id, input.id));
      return { success: true };
    }),

  listWebhookLogs: orgProcedure
    .input(z.object({ webhookId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return await db.query.webhookDeliveryLogs.findMany({
        where: and(
          eq(webhookDeliveryLogs.webhookId, input.webhookId),
          eq(webhookDeliveryLogs.orgId, ctx.org.id)
        ),
        orderBy: [desc(webhookDeliveryLogs.createdAt)],
        limit: 100,
      });
    }),
});
