import { z } from "zod";
import { createTRPCRouter, orgProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { users, orgMembers, teamInvitations } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { sendTeamInvitationEmail } from "@/server/lib/email-service";

export const teamRouter = createTRPCRouter({
  getTeamData: orgProcedure.query(async ({ ctx }) => {
    // Get all members for current org
    const members = await db.query.orgMembers.findMany({
      where: eq(orgMembers.orgId, ctx.org.id),
    });

    const userIds = members.map((m) => m.userId);
    const dbUsers = userIds.length > 0
      ? await db.query.users.findMany({
          where: (users, { inArray }) => inArray(users.id, userIds),
        })
      : [];
    const userMap = new Map(dbUsers.map((u) => [u.id, u]));

    const ownerMember = members.find((m) => m.role === "owner");
    const ownerUser = ownerMember ? userMap.get(ownerMember.userId) : null;

    const memberList = members
      .filter((m) => m.role !== "owner")
      .map((m) => {
        const u = userMap.get(m.userId);
        return {
          id: m.id,
          userId: m.userId,
          email: u?.email || "Unknown",
          fullName: u?.name || "Member",
          role: m.role,
        };
      });

    const pendingInvites = await db.query.teamInvitations.findMany({
      where: and(
        eq(teamInvitations.orgId, ctx.org.id),
        eq(teamInvitations.status, "pending")
      ),
    });

    return {
      owner: {
        id: ownerMember?.userId || "unknown",
        email: ownerUser?.email || "Unknown",
        fullName: ownerUser?.name || "Owner",
        role: "owner",
      },
      members: memberList,
      pendingInvites: pendingInvites.map((inv) => ({
        id: inv.id,
        email: inv.email,
        expiresAt: inv.expiresAt.toISOString(),
      })),
    };
  }),

  inviteMember: orgProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      // Check if user is already a member
      const user = await db.query.users.findFirst({
        where: eq(users.email, input.email.toLowerCase()),
      });

      if (user) {
        const existing = await db.query.orgMembers.findFirst({
          where: and(
            eq(orgMembers.orgId, ctx.org.id),
            eq(orgMembers.userId, user.id)
          ),
        });
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "User is already a member.",
          });
        }
      }

      // Create invite
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry
      const token = crypto.randomUUID();

      await db.insert(teamInvitations).values({
        orgId: ctx.org.id,
        email: input.email.toLowerCase(),
        token,
        invitedByUserId: ctx.session.user.id,
        expiresAt,
      });

      await sendTeamInvitationEmail(
        input.email.toLowerCase(),
        token,
        ctx.org.name,
        ctx.session.user.name || ctx.session.user.email || "A team member"
      );

      return { success: true };
    }),

  removeMember: orgProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const user = await db.query.users.findFirst({
        where: eq(users.email, input.email.toLowerCase()),
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      await db.delete(orgMembers).where(
        and(
          eq(orgMembers.orgId, ctx.org.id),
          eq(orgMembers.userId, user.id)
        )
      );
      return { success: true };
    }),

  cancelInvite: orgProcedure
    .input(z.object({ inviteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db.delete(teamInvitations).where(
        and(
          eq(teamInvitations.id, input.inviteId),
          eq(teamInvitations.orgId, ctx.org.id)
        )
      );
      return { success: true };
    }),
});
