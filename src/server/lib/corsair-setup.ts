import { createAccountKeyManager, generateDEK, encryptDEK } from "corsair/core";
import { db } from "@/server/db";
import { accounts, users, corsairIntegrations, corsairAccounts } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { env } from "@/env";

type DBType = Parameters<typeof createAccountKeyManager>[0]["database"];

export async function provisionCorsairTenant(userId: string, tenantId: string, kek: string) {
  // 1. Fetch Google account for this user from DB
  const userAccount = await db.query.accounts.findFirst({
    where: eq(accounts.userId, userId),
  });

  if (!userAccount?.access_token) {
    throw new Error("No Google OAuth credentials found in user account.");
  }

  // 2. Ensure integrations 'gmail' and 'googlecalendar' exist in corsair_integrations
  const plugins = ["gmail", "googlecalendar"];
  for (const pluginId of plugins) {
    const integration = await db.query.corsairIntegrations.findFirst({
      where: eq(corsairIntegrations.id, pluginId),
    });

    if (!integration) {
      const dek = generateDEK();
      const encryptedDek = await encryptDEK(dek, kek);
      await db.insert(corsairIntegrations).values({
        id: pluginId,
        name: pluginId,
        config: {
          client_id: env.AUTH_GOOGLE_ID,
          client_secret: env.AUTH_GOOGLE_SECRET,
          redirect_url: `${env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`,
        },
        dek: encryptedDek,
      });
    }

    // 3. Ensure account exists in corsair_accounts
    const account = await db.query.corsairAccounts.findFirst({
      where: and(
        eq(corsairAccounts.tenantId, tenantId),
        eq(corsairAccounts.integrationId, pluginId)
      ),
    });

    if (!account) {
      const dek = generateDEK();
      const encryptedDek = await encryptDEK(dek, kek);
      await db.insert(corsairAccounts).values({
        id: `${pluginId}_${tenantId}`,
        tenantId,
        integrationId: pluginId,
        config: {},
        dek: encryptedDek,
      });
    }

    // 4. Set credentials in key manager
    const accountKm = createAccountKeyManager({
      authType: "oauth_2",
      integrationName: pluginId,
      tenantId,
      kek,
      database: db as unknown as DBType,
    });

    await accountKm.set_access_token(userAccount.access_token);
    if (userAccount.refresh_token) {
      await accountKm.set_refresh_token(userAccount.refresh_token);
    }
    if (userAccount.expires_at) {
      await accountKm.set_expires_at(userAccount.expires_at.toString());
    }
  }

  // 5. Update user connected status
  await db
    .update(users)
    .set({
      gmailConnected: true,
      calendarConnected: true,
    })
    .where(eq(users.id, userId));
}
