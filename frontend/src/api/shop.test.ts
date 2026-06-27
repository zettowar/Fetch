import { beforeEach, describe, expect, it } from 'vitest';
import {
  addToCart,
  formatMoney,
  getCart,
  getProducts,
  priceLabel,
  removeCartLine,
  shopConfigured,
  updateCartLine,
} from './shop';

// With no VITE_SHOPIFY_* env set, the client runs against the in-memory demo
// catalog + a localStorage cart. These tests pin that fallback's behavior.
describe('shop demo mode', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reports itself as not configured', () => {
    expect(shopConfigured).toBe(false);
  });

  it('serves a demo catalog with variants and prices', async () => {
    const products = await getProducts();
    expect(products.length).toBeGreaterThan(0);
    const p = products[0];
    expect(p.handle).toBeTruthy();
    expect(p.variants.length).toBeGreaterThan(0);
    expect(priceLabel(p)).toMatch(/\d/);
  });

  it('adds, updates, and removes lines with running totals', async () => {
    const products = await getProducts();
    const variant = products[0].variants.find((v) => v.available);
    expect(variant).toBeDefined();
    const variantId = variant!.id;

    let cart = await addToCart(variantId, 2);
    expect(cart.totalQuantity).toBe(2);
    expect(cart.lines).toHaveLength(1);
    expect(cart.subtotal.amount).toBeCloseTo(variant!.price.amount * 2);

    // Adding the same variant merges rather than duplicating the line.
    cart = await addToCart(variantId, 1);
    expect(cart.lines).toHaveLength(1);
    expect(cart.totalQuantity).toBe(3);

    cart = await updateCartLine(variantId, 1);
    expect(cart.totalQuantity).toBe(1);

    cart = await removeCartLine(variantId);
    expect(cart.lines).toHaveLength(0);
    expect(cart.totalQuantity).toBe(0);
  });

  it('persists the cart across calls via localStorage', async () => {
    const products = await getProducts();
    const variantId = products[0].variants.find((v) => v.available)!.id;
    await addToCart(variantId, 1);

    const reread = await getCart();
    expect(reread.lines).toHaveLength(1);
  });

  it('has no live checkout url in demo mode', async () => {
    const products = await getProducts();
    const variantId = products[0].variants.find((v) => v.available)!.id;
    const cart = await addToCart(variantId, 1);
    expect(cart.checkoutUrl).toBeNull();
  });

  it('formats money in the variant currency', () => {
    expect(formatMoney({ amount: 26, currencyCode: 'USD' })).toContain('26');
  });
});
