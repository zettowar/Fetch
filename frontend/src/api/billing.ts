import client from './client';

export interface PremiumStatus {
  is_premium: boolean;
  entitlement: string | null;
}

export interface Entitlement {
  id: string;
  entitlement_key: string;
  source: string;
  expires_at: string | null;
  created_at: string;
}

export async function getPremiumStatus(): Promise<PremiumStatus> {
  const res = await client.get('/billing/status');
  return res.data;
}

export async function getMyEntitlements(): Promise<Entitlement[]> {
  const res = await client.get('/billing/entitlements');
  return res.data;
}

export async function adminGrantEntitlement(
  userId: string,
  entitlementKey = 'ads_removed',
  source = 'manual_grant',
): Promise<Entitlement> {
  const res = await client.post('/billing/grant', {
    user_id: userId,
    entitlement_key: entitlementKey,
    source,
  });
  return res.data;
}

export async function adminRevokeEntitlement(
  userId: string,
  entitlementKey = 'ads_removed',
): Promise<void> {
  await client.delete(`/billing/grant/${userId}/${entitlementKey}`);
}
