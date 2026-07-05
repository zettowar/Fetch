import { afterEach, describe, expect, it, vi } from 'vitest';
import client from './client';
import {
  createDonationCheckout,
  formatCents,
  getDonationBySession,
  getDonationConfig,
  getMyDonations,
} from './donations';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('donations api', () => {
  it('fetches config from /donations/config', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({
      data: { enabled: true, presets_cents: [500], min_cents: 100, max_cents: 100000, currency: 'usd', platform_fee_percent: 0 },
    });
    const config = await getDonationConfig();
    expect(get).toHaveBeenCalledWith('/donations/config');
    expect(config.enabled).toBe(true);
  });

  it('posts checkout with the request body and returns the redirect url', async () => {
    const post = vi.spyOn(client, 'post').mockResolvedValue({
      data: { donation_id: 'd1', checkout_url: 'https://checkout.stripe.com/x' },
    });
    const res = await createDonationCheckout({
      amount_cents: 1500,
      recipient_type: 'rescue',
      rescue_id: 'r1',
      message: 'For the pups',
    });
    expect(post).toHaveBeenCalledWith('/donations/checkout', {
      amount_cents: 1500,
      recipient_type: 'rescue',
      rescue_id: 'r1',
      message: 'For the pups',
    });
    expect(res.checkout_url).toContain('stripe.com');
  });

  it('fetches history and session lookups', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({ data: [] });
    await getMyDonations();
    expect(get).toHaveBeenCalledWith('/donations/me');
    await getDonationBySession('cs_123');
    expect(get).toHaveBeenCalledWith('/donations/by-session/cs_123');
  });

  it('formats cents as currency', () => {
    expect(formatCents(500)).toMatch(/5/);
    expect(formatCents(2500)).toMatch(/25/);
    // Whole dollars, locale-formatted — just pin that it doesn't render cents-as-dollars.
    expect(formatCents(100)).not.toMatch(/100/);
  });
});
