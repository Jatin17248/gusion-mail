import { corsair } from "@/server/corsair";

export function getTenant(corsairTenantId?: string | null) {
  const tenantId = corsairTenantId ?? "dev";
  return corsair.withTenant(tenantId);
}
