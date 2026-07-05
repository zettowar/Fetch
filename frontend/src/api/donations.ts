import client from './client';
import { formatMoney } from './shop';

export interface DonationConfig {
  enabled: boolean;
  currency: string;
  presets_cents: number[];
  min_cents: number;
  max_cents: number;
  platform_fee_percent: number;
}

export type DonationStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export interface Donation {
  id: string;
  recipient_type: 'platform' | 'rescue';
  rescue_id: string | null;
  recipient_name: string;
  amount_cents: number;
  currency: string;
  status: DonationStatus;
  message: string | null;
  created_at: string;
}

export interface ConnectStatus {
  has_account: boolean;
  charges_enabled: boolean;
  details_submitted: boolean | null;
}

export async function getDonationConfig(): Promise<DonationConfig> {
  const res = await client.get('/donations/config');
  return res.data;
}

export async function createDonationCheckout(body: {
  amount_cents: number;
  recipient_type: 'platform' | 'rescue';
  rescue_id?: string;
  message?: string;
}): Promise<{ donation_id: string; checkout_url: string }> {
  const res = await client.post('/donations/checkout', body);
  return res.data;
}

export async function getMyDonations(): Promise<Donation[]> {
  const res = await client.get('/donations/me');
  return res.data;
}

export async function getDonationBySession(sessionId: string): Promise<Donation> {
  const res = await client.get(`/donations/by-session/${sessionId}`);
  return res.data;
}

export async function connectOnboard(): Promise<{ url: string }> {
  const res = await client.post('/donations/connect/onboard');
  return res.data;
}

export async function getConnectStatus(): Promise<ConnectStatus> {
  const res = await client.get('/donations/connect/status');
  return res.data;
}

export function formatCents(cents: number, currency = 'USD'): string {
  return formatMoney({ amount: cents / 100, currencyCode: currency.toUpperCase() });
}
