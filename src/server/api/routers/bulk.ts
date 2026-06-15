import { z } from "zod";
import { createTRPCRouter, orgProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { bulkCampaigns, bulkRecipients, suppressionList, users } from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const bulkRouter = createTRPCRouter({
  listCampaigns: orgProcedure.query(async ({ ctx }) => {
    return await db.query.bulkCampaigns.findMany({
      where: eq(bulkCampaigns.orgId, ctx.org.id),
      orderBy: [desc(bulkCampaigns.createdAt)],
    });
  }),

  createCampaign: orgProcedure
    .input(
      z.object({
        name: z.string().min(1),
        subject: z.string().min(1),
        body: z.string().min(1),
        recipients: z.array(
          z.object({
            email: z.string().email(),
            variables: z.record(z.string(), z.string()).default({}),
          })
        ).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Find a user in the org who has gmail connected to send from
      const connectedUser = await db.query.users.findFirst({
        where: eq(users.id, ctx.session.user.id),
      });

      if (!connectedUser?.gmailConnected) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You must connect your Google account before starting campaigns.",
        });
      }

      // 1. Create the campaign
      const [campaign] = await db
        .insert(bulkCampaigns)
        .values({
          orgId: ctx.org.id,
          userId: connectedUser.id,
          name: input.name,
          subject: input.subject,
          body: input.body,
          status: "pending",
          totalRecipients: input.recipients.length,
          sentCount: 0,
          failedCount: 0,
        })
        .returning();

      if (!campaign) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create campaign.",
        });
      }

      // 2. Insert all recipients
      const recipientValues = input.recipients.map((r) => ({
        campaignId: campaign.id,
        email: r.email,
        variables: JSON.stringify(r.variables),
        status: "pending" as const,
      }));

      await db.insert(bulkRecipients).values(recipientValues);

      return campaign;
    }),

  startCampaign: orgProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await db.query.bulkCampaigns.findFirst({
        where: and(eq(bulkCampaigns.id, input.id), eq(bulkCampaigns.orgId, ctx.org.id)),
      });

      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found." });
      }

      const [updated] = await db
        .update(bulkCampaigns)
        .set({ status: "running" })
        .where(eq(bulkCampaigns.id, input.id))
        .returning();

      return updated;
    }),

  getCampaignDetails: orgProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const campaign = await db.query.bulkCampaigns.findFirst({
        where: and(eq(bulkCampaigns.id, input.id), eq(bulkCampaigns.orgId, ctx.org.id)),
      });

      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found." });
      }

      const recipientsList = await db.query.bulkRecipients.findMany({
        where: eq(bulkRecipients.campaignId, campaign.id),
      });

      return {
        campaign,
        recipients: recipientsList,
      };
    }),

  listSuppressionList: orgProcedure.query(async ({ ctx }) => {
    return await db.query.suppressionList.findMany({
      where: eq(suppressionList.orgId, ctx.org.id),
      orderBy: [desc(suppressionList.createdAt)],
    });
  }),

  addToSuppressionList: orgProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const [suppressed] = await db
        .insert(suppressionList)
        .values({
          orgId: ctx.org.id,
          email: input.email.toLowerCase().trim(),
        })
        .onConflictDoNothing()
        .returning();

      return suppressed ?? { email: input.email };
    }),

  removeFromSuppressionList: orgProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(suppressionList)
        .where(
          and(
            eq(suppressionList.orgId, ctx.org.id),
            eq(suppressionList.email, input.email.toLowerCase().trim())
          )
        );

      return { success: true };
    }),
});
