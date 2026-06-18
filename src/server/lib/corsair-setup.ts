import { createAccountKeyManager, createIntegrationKeyManager, generateDEK, encryptDEK } from "corsair/core";
import { createCorsairDatabase } from "corsair/db";
import { db, conn } from "@/server/db";
import { accounts, users, corsairIntegrations, corsairAccounts } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { env } from "@/env";

export async function provisionCorsairTenant(userId: string, tenantId: string, kek: string) {
  // 1. Fetch Google account for this user from DB
  const userAccount = await db.query.accounts.findFirst({
    where: eq(accounts.userId, userId),
  });

  if (!userAccount?.access_token) {
    throw new Error("No Google OAuth credentials found in user account.");
  }

  // 2. Upsert integrations 'gmail' and 'googlecalendar'.
  //    The integration DEK encrypts the OAuth client credentials (client_id, client_secret).
  //    We regenerate the DEK so it is always encrypted with the current KEK, then use
  //    createIntegrationKeyManager to re-encrypt the client credentials with the new DEK.
  //    Inserting plaintext credentials directly would make them unreadable to the SDK's
  //    keyBuilder (which expects AES-GCM encrypted values), silently breaking all API calls.
  const plugins = ["gmail", "googlecalendar"];
  for (const pluginId of plugins) {
    const integrationDek = generateDEK();
    const integrationEncryptedDek = await encryptDEK(integrationDek, kek);

    const existingIntegration = await db.query.corsairIntegrations.findFirst({
      where: eq(corsairIntegrations.id, pluginId),
    });
    if (!existingIntegration) {
      // First time: insert with empty config — credentials will be set via SDK below
      await db.insert(corsairIntegrations).values({
        id: pluginId,
        name: pluginId,
        config: {},
        dek: integrationEncryptedDek,
      });
    } else {
      // Rotate DEK to keep it encrypted with the current KEK
      await db.update(corsairIntegrations)
        .set({ dek: integrationEncryptedDek, updatedAt: new Date() })
        .where(eq(corsairIntegrations.id, pluginId));
    }

    // Re-encrypt client credentials with the new DEK.
    // The setter's built-in try-catch handles old-DEK-encrypted config gracefully:
    // if decryption fails (DEK rotated or first-time), it starts from {} and re-writes.
    const integrationKm = createIntegrationKeyManager({
      authType: "oauth_2",
      integrationName: pluginId,
      kek,
      database: createCorsairDatabase(conn),
    });
    await integrationKm.set_client_id(env.AUTH_GOOGLE_ID);
    await integrationKm.set_client_secret(env.AUTH_GOOGLE_SECRET);
    await integrationKm.set_redirect_url(`${env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`);

    // 3. Upsert account — always regenerate DEK for the same reason
    const accountDek = generateDEK();
    const accountEncryptedDek = await encryptDEK(accountDek, kek);

    const existingAccount = await db.query.corsairAccounts.findFirst({
      where: and(
        eq(corsairAccounts.tenantId, tenantId),
        eq(corsairAccounts.integrationId, pluginId)
      ),
    });
    if (!existingAccount) {
      await db.insert(corsairAccounts).values({
        id: `${pluginId}_${tenantId}`,
        tenantId,
        integrationId: pluginId,
        config: {},
        dek: accountEncryptedDek,
      });
    } else {
      await db.update(corsairAccounts)
        .set({ dek: accountEncryptedDek, config: {}, updatedAt: new Date() })
        .where(and(
          eq(corsairAccounts.tenantId, tenantId),
          eq(corsairAccounts.integrationId, pluginId)
        ));
    }

    // 4. Set credentials in key manager (now using the freshly-written DEK)
    const accountKm = createAccountKeyManager({
      authType: "oauth_2",
      integrationName: pluginId,
      tenantId,
      kek,
      database: createCorsairDatabase(conn),
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

/**
 * Re-push the latest OAuth tokens from NextAuth's `accounts` table into
 * Corsair's key manager. Also regenerates DEKs encrypted with the current KEK
 * so a changed CORSAIR_KEK env var never causes "Invalid encrypted data format".
 * Returns false when the user has no Google OAuth account linked.
 */
export async function refreshCorsairTokens(
  userId: string,
  tenantId: string,
  kek: string,
): Promise<boolean> {
  const userAccount = await db.query.accounts.findFirst({
    where: eq(accounts.userId, userId),
  });
  if (!userAccount?.access_token) return false;

  for (const pluginId of ["gmail", "googlecalendar"]) {
    // Always re-encrypt the account's DEK with the current KEK before writing tokens,
    // AND clear config so any stale data encrypted with the old DEK doesn't cause
    // AES-GCM auth failures ("Unsupported state or unable to authenticate data").
    const freshDek = generateDEK();
    const freshEncryptedDek = await encryptDEK(freshDek, kek);
    const existingAccount = await db.query.corsairAccounts.findFirst({
      where: and(
        eq(corsairAccounts.tenantId, tenantId),
        eq(corsairAccounts.integrationId, pluginId)
      ),
    });
    if (existingAccount) {
      await db.update(corsairAccounts)
        .set({ dek: freshEncryptedDek, config: {}, updatedAt: new Date() })
        .where(and(
          eq(corsairAccounts.tenantId, tenantId),
          eq(corsairAccounts.integrationId, pluginId)
        ));
    }

    const accountKm = createAccountKeyManager({
      authType: "oauth_2",
      integrationName: pluginId,
      tenantId,
      kek,
      database: createCorsairDatabase(conn),
    });
    await accountKm.set_access_token(userAccount.access_token);
    if (userAccount.refresh_token) {
      await accountKm.set_refresh_token(userAccount.refresh_token);
    }
    if (userAccount.expires_at) {
      await accountKm.set_expires_at(userAccount.expires_at.toString());
    }
  }
  return true;
}
