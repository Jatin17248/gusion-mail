import { z } from "zod";
import { createTRPCRouter, orgProcedure, requireOrgRole } from "@/server/api/trpc";
import { db } from "@/server/db";
import { users, organizations, orgMembers } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const orgRouter = createTRPCRouter({
  getOrg: orgProcedure.query(async ({ ctx }) => {
    return ctx.org;
  }),

  updateOrgName: orgProcedure
    .input(z.object({ name: z.string().min(1) }))
    .use(requireOrgRole(["owner", "admin"]))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(organizations)
        .set({ name: input.name, updatedAt: new Date() })
        .where(eq(organizations.id, ctx.org.id))
        .returning();

      return updated;
    }),

  listMembers: orgProcedure.query(async ({ ctx }) => {
    const members = await db.query.orgMembers.findMany({
      where: eq(orgMembers.orgId, ctx.org.id),
      orderBy: (orgMembers, { asc }) => [asc(orgMembers.createdAt)],
    });

    const userIds = members.map((m) => m.userId);
    const dbUsers = userIds.length > 0
      ? await db.query.users.findMany({
          where: inArray(users.id, userIds),
        })
      : [];

    const userMap = new Map(dbUsers.map((u) => [u.id, u]));

    return members.map((m) => {
      const u = userMap.get(m.userId);
      return {
        id: m.id,
        userId: m.userId,
        name: u?.name ?? "Unknown",
        email: u?.email ?? "Unknown",
        role: m.role,
        createdAt: m.createdAt,
      };
    });
  }),

  inviteMember: orgProcedure
    .input(
      z.object({
        email: z.string().email(),
        role: z.enum(["admin", "member"]),
      })
    )
    .use(requireOrgRole(["owner", "admin"]))
    .mutation(async ({ ctx, input }) => {
      // 1. Check if user already exists
      let user = await db.query.users.findFirst({
        where: eq(users.email, input.email.toLowerCase()),
      });

      if (!user) {
        // Create user placeholder
        const [newUser] = await db
          .insert(users)
          .values({
            email: input.email.toLowerCase(),
            name: input.email.split("@")[0],
          })
          .returning();
        if (!newUser) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create user." });
        }
        user = newUser;
      }

      // 2. Check if already a member
      const existing = await db.query.orgMembers.findFirst({
        where: and(
          eq(orgMembers.orgId, ctx.org.id),
          eq(orgMembers.userId, user.id)
        ),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User is already a member of this organization.",
        });
      }

      // 3. Insert into orgMembers
      const [inserted] = await db
        .insert(orgMembers)
        .values({
          orgId: ctx.org.id,
          userId: user.id,
          role: input.role,
        })
        .returning();

      return inserted;
    }),

  updateMemberRole: orgProcedure
    .input(
      z.object({
        memberId: z.string().min(1),
        role: z.enum(["admin", "member"]),
      })
    )
    .use(requireOrgRole(["owner", "admin"]))
    .mutation(async ({ ctx, input }) => {
      const member = await db.query.orgMembers.findFirst({
        where: and(
          eq(orgMembers.id, input.memberId),
          eq(orgMembers.orgId, ctx.org.id)
        ),
      });

      if (!member) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found." });
      }

      if (member.role === "owner") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot change owner role." });
      }

      const [updated] = await db
        .update(orgMembers)
        .set({ role: input.role, updatedAt: new Date() })
        .where(eq(orgMembers.id, input.memberId))
        .returning();

      return updated;
    }),

  removeMember: orgProcedure
    .input(z.object({ memberId: z.string().min(1) }))
    .use(requireOrgRole(["owner", "admin"]))
    .mutation(async ({ ctx, input }) => {
      const member = await db.query.orgMembers.findFirst({
        where: and(
          eq(orgMembers.id, input.memberId),
          eq(orgMembers.orgId, ctx.org.id)
        ),
      });

      if (!member) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found." });
      }

      if (member.role === "owner") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot remove owner from organization." });
      }

      await db.delete(orgMembers).where(eq(orgMembers.id, input.memberId));

      return { success: true };
    }),
});

import { inArray } from "drizzle-orm";
