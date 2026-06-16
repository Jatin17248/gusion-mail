import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { accounts } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { google } from "googleapis";
import { TRPCError } from "@trpc/server";

export const sheetsRouter = createTRPCRouter({
  listSpreadsheets: protectedProcedure.query(async ({ ctx }) => {
    const account = await db.query.accounts.findFirst({
      where: and(eq(accounts.userId, ctx.session.user.id), eq(accounts.provider, "google")),
    });

    if (!account || !account.access_token) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Google account not connected" });
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
    });

    const drive = google.drive({ version: "v3", auth: oauth2Client });
    try {
      const res = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet'",
        fields: "files(id, name, modifiedTime)",
        orderBy: "modifiedTime desc",
        pageSize: 50,
      });
      return res.data.files || [];
    } catch (e) {
      console.error("Failed to fetch sheets", e);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch sheets" });
    }
  }),

  getSpreadsheetMetadata: protectedProcedure
    .input(z.object({ spreadsheetId: z.string() }))
    .query(async ({ ctx, input }) => {
      const account = await db.query.accounts.findFirst({
        where: and(eq(accounts.userId, ctx.session.user.id), eq(accounts.provider, "google")),
      });

      if (!account || !account.access_token) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Google account not connected" });
      }

      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({
        access_token: account.access_token,
        refresh_token: account.refresh_token,
      });

      const sheets = google.sheets({ version: "v4", auth: oauth2Client });
      try {
        const res = await sheets.spreadsheets.get({
          spreadsheetId: input.spreadsheetId,
          includeGridData: false,
        });
        return res.data;
      } catch (e) {
        console.error("Failed to fetch sheet metadata", e);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch sheet metadata" });
      }
    }),

  getSpreadsheetData: protectedProcedure
    .input(z.object({ spreadsheetId: z.string(), range: z.string() }))
    .query(async ({ ctx, input }) => {
      const account = await db.query.accounts.findFirst({
        where: and(eq(accounts.userId, ctx.session.user.id), eq(accounts.provider, "google")),
      });

      if (!account || !account.access_token) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Google account not connected" });
      }

      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({
        access_token: account.access_token,
        refresh_token: account.refresh_token,
      });

      const sheets = google.sheets({ version: "v4", auth: oauth2Client });
      try {
        const res = await sheets.spreadsheets.values.get({
          spreadsheetId: input.spreadsheetId,
          range: input.range,
        });
        return res.data.values || [];
      } catch (e) {
        console.error("Failed to fetch sheet data", e);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch sheet data" });
      }
    }),
});
