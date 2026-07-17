// Shop / merchandise client.
//
// Talks to Shopify's Storefront API (GraphQL) when a store is configured via
// VITE_SHOPIFY_DOMAIN + VITE_SHOPIFY_STOREFRONT_TOKEN. When those are empty —
// e.g. before the Shopify account exists — it transparently falls back to a
// self-contained DEMO catalog + localStorage cart so the whole shop UI is
// browsable and clickable end to end. The pages never know which mode is live;
// they consume the normalized types below either way.
//
// This mirrors the codebase convention of "empty key = graceful stub" used for
// image moderation (Sightengine) and billing.

const DOMAIN = (import.meta.env.VITE_SHOPIFY_DOMAIN ?? '').trim();
const TOKEN = (import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN ?? '').trim();
// Shopify supports Storefront API versions for ~12 months — bump quarterly.
const API_VERSION = '2025-04';
const CART_ID_KEY = 'fetch_shop_cart_id';
const MOCK_CART_KEY = 'fetch_shop_cart_demo';
const DEFAULT_CURRENCY = 'USD';

/** True once a real Shopify store is wired up. Pages use this to show a small
 *  "Demo" hint and to disable the live-checkout redirect in demo mode. */
export const shopConfigured = Boolean(DOMAIN && TOKEN);

// ─── Normalized types (what the UI consumes) ──────────────────────────────

export interface ShopMoney {
  amount: number;
  currencyCode: string;
}

export interface ShopImage {
  url: string;
  altText: string | null;
}

export interface ShopProductOption {
  name: string;
  values: string[];
}

export interface ShopVariant {
  id: string;
  title: string;
  available: boolean;
  price: ShopMoney;
  options: { name: string; value: string }[];
}

export interface ShopProduct {
  id: string;
  handle: string;
  title: string;
  description: string;
  tags: string[];
  available: boolean;
  featuredImage: ShopImage | null;
  images: ShopImage[];
  options: ShopProductOption[];
  priceRange: { min: ShopMoney; max: ShopMoney };
  variants: ShopVariant[];
}

export interface ShopCartLine {
  id: string;
  variantId: string;
  quantity: number;
  productTitle: string;
  productHandle: string;
  variantTitle: string;
  image: ShopImage | null;
  unitPrice: ShopMoney;
  lineTotal: ShopMoney;
}

export interface ShopCart {
  id: string;
  checkoutUrl: string | null;
  totalQuantity: number;
  subtotal: ShopMoney;
  lines: ShopCartLine[];
}

// ─── Display helpers ──────────────────────────────────────────────────────

export function formatMoney(m: ShopMoney): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: m.currencyCode || DEFAULT_CURRENCY,
    }).format(m.amount);
  } catch {
    return `$${m.amount.toFixed(2)}`;
  }
}

/** "From $26.00" when a product spans variant prices, else the flat price. */
export function priceLabel(p: ShopProduct): string {
  const min = formatMoney(p.priceRange.min);
  return p.priceRange.min.amount !== p.priceRange.max.amount ? `From ${min}` : min;
}

/** Shopify represents option-less products with a single "Title" option. */
export function hasVariantChoices(p: ShopProduct): boolean {
  return !(p.options.length === 1 && p.options[0].name === 'Title');
}

export function findVariant(
  p: ShopProduct,
  selected: Record<string, string>,
): ShopVariant | undefined {
  return p.variants.find((v) => v.options.every((o) => selected[o.name] === o.value));
}

function emptyCart(): ShopCart {
  return {
    id: '',
    checkoutUrl: null,
    totalQuantity: 0,
    subtotal: { amount: 0, currencyCode: DEFAULT_CURRENCY },
    lines: [],
  };
}

// ─── Shopify Storefront API (real mode) ───────────────────────────────────

interface SFMoney {
  amount: string;
  currencyCode: string;
}
interface SFImage {
  url: string;
  altText: string | null;
}
interface SFVariantNode {
  id: string;
  title: string;
  availableForSale: boolean;
  price: SFMoney;
  selectedOptions: { name: string; value: string }[];
}
interface SFProductNode {
  id: string;
  handle: string;
  title: string;
  description: string;
  tags: string[];
  availableForSale: boolean;
  featuredImage: SFImage | null;
  images: { nodes: SFImage[] };
  options: { name: string; values: string[] }[];
  priceRange: { minVariantPrice: SFMoney; maxVariantPrice: SFMoney };
  variants: { nodes: SFVariantNode[] };
}
interface SFCartLineNode {
  id: string;
  quantity: number;
  cost: { totalAmount: SFMoney };
  merchandise: {
    id: string;
    title: string;
    image: SFImage | null;
    price: SFMoney;
    product: { title: string; handle: string };
  };
}
interface SFCart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: { subtotalAmount: SFMoney };
  lines: { nodes: SFCartLineNode[] };
}
interface SFUserError {
  message: string;
}

function mapMoney(m: SFMoney): ShopMoney {
  return { amount: parseFloat(m.amount), currencyCode: m.currencyCode };
}

function mapProduct(n: SFProductNode): ShopProduct {
  return {
    id: n.id,
    handle: n.handle,
    title: n.title,
    description: n.description ?? '',
    tags: n.tags ?? [],
    available: n.availableForSale,
    featuredImage: n.featuredImage
      ? { url: n.featuredImage.url, altText: n.featuredImage.altText }
      : null,
    images: (n.images?.nodes ?? []).map((i) => ({ url: i.url, altText: i.altText })),
    options: (n.options ?? []).map((o) => ({ name: o.name, values: o.values })),
    priceRange: {
      min: mapMoney(n.priceRange.minVariantPrice),
      max: mapMoney(n.priceRange.maxVariantPrice),
    },
    variants: (n.variants?.nodes ?? []).map((v) => ({
      id: v.id,
      title: v.title,
      available: v.availableForSale,
      price: mapMoney(v.price),
      options: (v.selectedOptions ?? []).map((s) => ({ name: s.name, value: s.value })),
    })),
  };
}

function mapCart(c: SFCart): ShopCart {
  return {
    id: c.id,
    checkoutUrl: c.checkoutUrl ?? null,
    totalQuantity: c.totalQuantity ?? 0,
    subtotal: mapMoney(c.cost.subtotalAmount),
    lines: (c.lines?.nodes ?? []).map((l) => {
      const m = l.merchandise;
      return {
        id: l.id,
        variantId: m.id,
        quantity: l.quantity,
        productTitle: m.product?.title ?? '',
        productHandle: m.product?.handle ?? '',
        // "Default Title" is Shopify's sentinel for option-less products.
        variantTitle: m.title === 'Default Title' ? '' : m.title,
        image: m.image ? { url: m.image.url, altText: m.image.altText } : null,
        unitPrice: mapMoney(m.price),
        lineTotal: mapMoney(l.cost.totalAmount),
      };
    }),
  };
}

const PRODUCT_FIELDS = `
  id
  handle
  title
  description
  tags
  availableForSale
  featuredImage { url altText }
  images(first: 8) { nodes { url altText } }
  options { name values }
  priceRange {
    minVariantPrice { amount currencyCode }
    maxVariantPrice { amount currencyCode }
  }
  variants(first: 100) {
    nodes {
      id
      title
      availableForSale
      price { amount currencyCode }
      selectedOptions { name value }
    }
  }
`;

const CART_FIELDS = `
  id
  checkoutUrl
  totalQuantity
  cost { subtotalAmount { amount currencyCode } }
  lines(first: 100) {
    nodes {
      id
      quantity
      cost { totalAmount { amount currencyCode } }
      merchandise {
        ... on ProductVariant {
          id
          title
          image { url altText }
          price { amount currencyCode }
          product { title handle }
        }
      }
    }
  }
`;

const PRODUCTS_QUERY = `query Products($first: Int!) { products(first: $first) { nodes { ${PRODUCT_FIELDS} } } }`;
const PRODUCT_QUERY = `query Product($handle: String!) { product(handle: $handle) { ${PRODUCT_FIELDS} } }`;
const CART_QUERY = `query Cart($id: ID!) { cart(id: $id) { ${CART_FIELDS} } }`;
const CART_CREATE = `mutation CartCreate($lines: [CartLineInput!]!) { cartCreate(input: { lines: $lines }) { cart { ${CART_FIELDS} } userErrors { message } } }`;
const CART_LINES_ADD = `mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) { cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ${CART_FIELDS} } userErrors { message } } }`;
const CART_LINES_UPDATE = `mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) { cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { ${CART_FIELDS} } userErrors { message } } }`;
const CART_LINES_REMOVE = `mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) { cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ${CART_FIELDS} } userErrors { message } } }`;

async function storefront<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://${DOMAIN}/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Shopify request failed (${res.status})`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors && json.errors.length) throw new Error(json.errors[0].message);
  if (!json.data) throw new Error('Shopify returned no data');
  return json.data;
}

function firstError(errors: SFUserError[]): void {
  if (errors && errors.length) throw new Error(errors[0].message);
}

async function sfGetProducts(): Promise<ShopProduct[]> {
  const data = await storefront<{ products: { nodes: SFProductNode[] } }>(PRODUCTS_QUERY, {
    first: 50,
  });
  return data.products.nodes.map(mapProduct);
}

async function sfGetProduct(handle: string): Promise<ShopProduct | null> {
  const data = await storefront<{ product: SFProductNode | null }>(PRODUCT_QUERY, { handle });
  return data.product ? mapProduct(data.product) : null;
}

async function sfGetCart(): Promise<ShopCart> {
  const id = localStorage.getItem(CART_ID_KEY);
  if (!id) return emptyCart();
  const data = await storefront<{ cart: SFCart | null }>(CART_QUERY, { id });
  if (!data.cart) {
    // Cart expired or was completed — start fresh next add.
    localStorage.removeItem(CART_ID_KEY);
    return emptyCart();
  }
  return mapCart(data.cart);
}

async function sfAddToCart(variantId: string, quantity: number): Promise<ShopCart> {
  const id = localStorage.getItem(CART_ID_KEY);
  const lines = [{ merchandiseId: variantId, quantity }];
  if (!id) {
    const data = await storefront<{
      cartCreate: { cart: SFCart | null; userErrors: SFUserError[] };
    }>(CART_CREATE, { lines });
    firstError(data.cartCreate.userErrors);
    const cart = data.cartCreate.cart;
    if (!cart) throw new Error('Could not create cart');
    localStorage.setItem(CART_ID_KEY, cart.id);
    return mapCart(cart);
  }
  const data = await storefront<{
    cartLinesAdd: { cart: SFCart | null; userErrors: SFUserError[] };
  }>(CART_LINES_ADD, { cartId: id, lines });
  firstError(data.cartLinesAdd.userErrors);
  if (!data.cartLinesAdd.cart) throw new Error('Could not add to cart');
  return mapCart(data.cartLinesAdd.cart);
}

async function sfRemoveLine(lineId: string): Promise<ShopCart> {
  const id = localStorage.getItem(CART_ID_KEY);
  if (!id) return emptyCart();
  const data = await storefront<{
    cartLinesRemove: { cart: SFCart | null; userErrors: SFUserError[] };
  }>(CART_LINES_REMOVE, { cartId: id, lineIds: [lineId] });
  firstError(data.cartLinesRemove.userErrors);
  return data.cartLinesRemove.cart ? mapCart(data.cartLinesRemove.cart) : emptyCart();
}

async function sfUpdateLine(lineId: string, quantity: number): Promise<ShopCart> {
  if (quantity <= 0) return sfRemoveLine(lineId);
  const id = localStorage.getItem(CART_ID_KEY);
  if (!id) return emptyCart();
  const data = await storefront<{
    cartLinesUpdate: { cart: SFCart | null; userErrors: SFUserError[] };
  }>(CART_LINES_UPDATE, { cartId: id, lines: [{ id: lineId, quantity }] });
  firstError(data.cartLinesUpdate.userErrors);
  return data.cartLinesUpdate.cart ? mapCart(data.cartLinesUpdate.cart) : emptyCart();
}

// ─── Demo catalog (fallback when no Shopify store is configured) ───────────

const MOCK_CURRENCY = 'USD';

function mockImage(emoji: string, label: string): ShopImage {
  // Inline SVG so the demo catalog has no external image dependency.
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">` +
    `<rect width="600" height="600" fill="#fff7ed"/>` +
    `<text x="300" y="310" font-size="300" text-anchor="middle" dominant-baseline="central">${emoji}</text>` +
    `</svg>`;
  return { url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, altText: label };
}

function buildMock(def: {
  handle: string;
  title: string;
  description: string;
  emoji: string;
  price: number;
  tags: string[];
  sizes?: string[];
  soldOutSizes?: string[];
}): ShopProduct {
  const price: ShopMoney = { amount: def.price, currencyCode: MOCK_CURRENCY };
  const img = mockImage(def.emoji, def.title);
  let options: ShopProductOption[];
  let variants: ShopVariant[];
  if (def.sizes && def.sizes.length) {
    options = [{ name: 'Size', values: def.sizes }];
    variants = def.sizes.map((size) => ({
      id: `mock-${def.handle}-${size}`,
      title: size,
      available: !(def.soldOutSizes ?? []).includes(size),
      price,
      options: [{ name: 'Size', value: size }],
    }));
  } else {
    options = [{ name: 'Title', values: ['Default Title'] }];
    variants = [
      {
        id: `mock-${def.handle}-default`,
        title: 'Default Title',
        available: true,
        price,
        options: [{ name: 'Title', value: 'Default Title' }],
      },
    ];
  }
  return {
    id: `mock-product-${def.handle}`,
    handle: def.handle,
    title: def.title,
    description: def.description,
    tags: def.tags,
    available: variants.some((v) => v.available),
    featuredImage: img,
    images: [img],
    options,
    priceRange: { min: price, max: price },
    variants,
  };
}

const MOCK_PRODUCTS: ShopProduct[] = [
  buildMock({
    handle: 'fetch-classic-tee',
    title: 'Fetchpawz classic tee',
    description:
      'Soft 100% cotton tee with the Fetchpawz paw mark on the chest. Your everyday pet-park uniform.',
    emoji: '👕',
    price: 26,
    tags: ['apparel', 'branded'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    soldOutSizes: ['XXL'],
  }),
  buildMock({
    handle: 'top-pet-hoodie',
    title: 'Top Pet hoodie',
    description:
      'Cozy fleece-lined hoodie for cold morning walks. Embroidered "Top Pet" crest on the front.',
    emoji: '🧥',
    price: 48,
    tags: ['apparel', 'branded'],
    sizes: ['S', 'M', 'L', 'XL'],
  }),
  buildMock({
    handle: 'fetch-bandana',
    title: 'Fetchpawz bandana',
    description:
      'Reversible cotton bandana that snaps onto any collar. Because your pet deserves merch too.',
    emoji: '🧣',
    price: 16,
    tags: ['pet', 'accessory'],
    sizes: ['Small', 'Large'],
  }),
  buildMock({
    handle: 'good-pet-mug',
    title: 'Good Pet ceramic mug',
    description: '12oz stoneware mug for your coffee and their treats. Dishwasher safe.',
    emoji: '☕',
    price: 18,
    tags: ['home', 'branded'],
  }),
  buildMock({
    handle: 'paw-enamel-pin',
    title: 'Paw enamel pin',
    description: 'Hard-enamel Fetchpawz paw pin with a rubber clutch back. Perfect for bags and jackets.',
    emoji: '📌',
    price: 9,
    tags: ['accessory', 'branded'],
  }),
  buildMock({
    handle: 'adventure-water-bottle',
    title: 'Adventure water bottle',
    description:
      'Insulated 24oz bottle with a fold-out pet bowl lid. Keep you both hydrated on the trail.',
    emoji: '🍶',
    price: 22,
    tags: ['gear', 'pet'],
  }),
];

const MOCK_VARIANT_INDEX = new Map<string, { product: ShopProduct; variant: ShopVariant }>();
for (const p of MOCK_PRODUCTS) {
  for (const v of p.variants) MOCK_VARIANT_INDEX.set(v.id, { product: p, variant: v });
}

interface MockLine {
  variantId: string;
  quantity: number;
}

function readMockLines(): MockLine[] {
  try {
    const raw = localStorage.getItem(MOCK_CART_KEY);
    return raw ? (JSON.parse(raw) as MockLine[]) : [];
  } catch {
    return [];
  }
}

function writeMockLines(lines: MockLine[]): void {
  try {
    localStorage.setItem(MOCK_CART_KEY, JSON.stringify(lines));
  } catch {
    // localStorage unavailable (e.g. Safari private mode) — the cart still
    // works for this page view, it just won't persist across reloads.
  }
}

function buildMockCart(lines: MockLine[]): ShopCart {
  const cartLines: ShopCartLine[] = [];
  let subtotal = 0;
  let totalQuantity = 0;
  for (const l of lines) {
    const found = MOCK_VARIANT_INDEX.get(l.variantId);
    if (!found) continue;
    const { product, variant } = found;
    const lineTotal = variant.price.amount * l.quantity;
    subtotal += lineTotal;
    totalQuantity += l.quantity;
    cartLines.push({
      // Demo carts reuse the variant id as the line id; pages treat it opaquely.
      id: variant.id,
      variantId: variant.id,
      quantity: l.quantity,
      productTitle: product.title,
      productHandle: product.handle,
      variantTitle: hasVariantChoices(product) ? variant.title : '',
      image: product.featuredImage,
      unitPrice: variant.price,
      lineTotal: { amount: lineTotal, currencyCode: MOCK_CURRENCY },
    });
  }
  return {
    id: 'mock-cart',
    checkoutUrl: null,
    totalQuantity,
    subtotal: { amount: subtotal, currencyCode: MOCK_CURRENCY },
    lines: cartLines,
  };
}

function mockAdd(variantId: string, quantity: number): ShopCart {
  const lines = readMockLines();
  const existing = lines.find((l) => l.variantId === variantId);
  if (existing) existing.quantity += quantity;
  else lines.push({ variantId, quantity });
  writeMockLines(lines);
  return buildMockCart(lines);
}

function mockUpdate(lineId: string, quantity: number): ShopCart {
  let lines = readMockLines();
  if (quantity <= 0) {
    lines = lines.filter((l) => l.variantId !== lineId);
  } else {
    const existing = lines.find((l) => l.variantId === lineId);
    if (existing) existing.quantity = quantity;
  }
  writeMockLines(lines);
  return buildMockCart(lines);
}

function mockRemove(lineId: string): ShopCart {
  const lines = readMockLines().filter((l) => l.variantId !== lineId);
  writeMockLines(lines);
  return buildMockCart(lines);
}

// ─── Public API (mode-agnostic) ───────────────────────────────────────────

export async function getProducts(): Promise<ShopProduct[]> {
  return shopConfigured ? sfGetProducts() : MOCK_PRODUCTS;
}

export async function getProduct(handle: string): Promise<ShopProduct | null> {
  return shopConfigured
    ? sfGetProduct(handle)
    : (MOCK_PRODUCTS.find((p) => p.handle === handle) ?? null);
}

export async function getCart(): Promise<ShopCart> {
  return shopConfigured ? sfGetCart() : buildMockCart(readMockLines());
}

export async function addToCart(variantId: string, quantity = 1): Promise<ShopCart> {
  return shopConfigured ? sfAddToCart(variantId, quantity) : mockAdd(variantId, quantity);
}

export async function updateCartLine(lineId: string, quantity: number): Promise<ShopCart> {
  return shopConfigured ? sfUpdateLine(lineId, quantity) : mockUpdate(lineId, quantity);
}

export async function removeCartLine(lineId: string): Promise<ShopCart> {
  return shopConfigured ? sfRemoveLine(lineId) : mockRemove(lineId);
}
