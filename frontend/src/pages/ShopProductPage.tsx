import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  findVariant,
  formatMoney,
  getProduct,
  hasVariantChoices,
  shopConfigured,
  type ShopProduct,
} from '../api/shop';
import { useCart } from '../utils/useCart';
import BrandIcon from '../components/brand/BrandIcon';
import Button from '../components/ui/Button';
import BackButton from '../components/ui/BackButton';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { Spinner } from '../components/ui/Skeleton';
import { useDocumentTitle } from '../utils/useDocumentTitle';

// Quantity stepper: a pill with a navy hairline, shared look with the cart.
const STEPPER =
  'inline-flex items-center rounded-full border-2 border-navy/25 bg-white overflow-hidden dark:border-white/20 dark:bg-night-surface';
const STEP_BTN =
  'px-3 py-1.5 text-lg font-extrabold leading-none text-navy hover:bg-navy/5 disabled:opacity-40 dark:text-biscuit dark:hover:bg-white/10';

function defaultSelection(product: ShopProduct): Record<string, string> {
  // Prefer the first in-stock variant so the page opens on something buyable.
  const variant = product.variants.find((v) => v.available) ?? product.variants[0];
  const selection: Record<string, string> = {};
  for (const o of variant?.options ?? []) selection[o.name] = o.value;
  return selection;
}

export default function ShopProductPage() {
  const { handle = '' } = useParams();
  const { add } = useCart();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  const {
    data: product,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['shop-product', handle],
    queryFn: () => getProduct(handle),
    enabled: Boolean(handle),
  });

  useDocumentTitle(product ? `${product.title} · Fetchpawz Shop` : null);

  // Seed the option selection once per product. Keyed on a ref rather than on
  // `product` identity: a background refetch returns a new object, and
  // re-seeding would throw away the options the shopper had picked.
  const seededProductId = useRef<string | null>(null);
  useEffect(() => {
    if (!product || seededProductId.current === product.id) return;
    seededProductId.current = product.id;
    setSelected(defaultSelection(product));
  }, [product]);

  const variant = useMemo(
    () => (product ? findVariant(product, selected) : undefined),
    [product, selected],
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4">
        <BackButton fallback="/app/shop" label="Shop" />
        <ErrorState message="Couldn't load this product." onRetry={() => refetch()} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-4">
        <BackButton fallback="/app/shop" label="Shop" />
        <EmptyState
          illustration="sniffing"
          title="This product isn't available."
          action={
            <Link to="/app/shop" className="btn btn-secondary btn-sm">
              Back to shop
            </Link>
          }
        />
      </div>
    );
  }

  const images = product.images.length > 0 ? product.images : product.featuredImage ? [product.featuredImage] : [];
  const hero = images[activeImage] ?? product.featuredImage;
  const showOptions = hasVariantChoices(product);
  const soldOut = !variant || !variant.available;

  const handleAdd = () => {
    if (!variant) return;
    add.mutate(
      { variantId: variant.id, quantity: qty },
      { onSuccess: () => toast.success('Added to cart') },
    );
  };

  return (
    // From `md` the photos sit beside the details, the gallery held in view
    // while the details scroll. `contents` keeps the phone stack's order.
    <div className="p-4 pb-8 md:grid md:grid-cols-2 md:items-start md:gap-x-8 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:gap-x-10">
      <div className="contents md:block md:col-span-2">
        <BackButton fallback="/app/shop" label="Shop" />
      </div>

      <div className="contents md:block md:min-w-0 md:sticky md:top-20">
      <div className="rounded-3xl overflow-hidden border border-gray-200 dark:border-white/10 bg-white dark:bg-night-surface">
        {hero ? (
          <img
            src={hero.url}
            alt={hero.altText ?? product.title}
            className="w-full aspect-square object-cover"
          />
        ) : (
          <div className="w-full aspect-square bg-brand-50 dark:bg-night-raised flex items-center justify-center text-navy/40 dark:text-biscuit/40">
            <BrandIcon name="bag" size={80} />
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 mt-2 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              onClick={() => setActiveImage(i)}
              aria-label={`View image ${i + 1}`}
              className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                i === activeImage ? 'border-brand-500' : 'border-navy/20 opacity-70 dark:border-white/15'
              }`}
            >
              <img src={img.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      </div>

      <div className="contents md:block md:min-w-0">
      <div className="mt-4 md:mt-0">
        <h1 className="text-[28px] leading-none text-navy dark:text-biscuit text-balance">{product.title}</h1>
        <p className="font-display text-2xl leading-none tabular-nums text-navy dark:text-biscuit mt-2">
          {variant ? formatMoney(variant.price) : formatMoney(product.priceRange.min)}
        </p>
      </div>

      {showOptions &&
        product.options.map((option) => (
          <div key={option.name} className="mt-4">
            <p className="field-label mb-1.5">
              {option.name}
            </p>
            <div className="flex flex-wrap gap-2">
              {option.values.map((value) => {
                const isSelected = selected[option.name] === value;
                // Soft hint: dim a value only when no variant carrying it is in stock.
                const valueAvailable = product.variants.some(
                  (v) => v.available && v.options.some((o) => o.name === option.name && o.value === value),
                );
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelected((prev) => ({ ...prev, [option.name]: value }))}
                    className={`chip ${isSelected ? 'chip-on' : 'hover:bg-gray-50 dark:hover:bg-night-surface'} ${!valueAvailable ? 'opacity-40' : ''}`}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

      <div className="mt-5 flex items-center gap-3">
        <span className="field-label">Qty</span>
        <div className={STEPPER}>
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className={STEP_BTN}
            disabled={qty <= 1}
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="px-4 text-sm font-extrabold tabular-nums text-navy dark:text-biscuit">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => q + 1)}
            className={STEP_BTN}
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button
          size="lg"
          onClick={handleAdd}
          loading={add.isPending}
          disabled={soldOut}
          className="flex-1"
        >
          {soldOut ? 'Sold out' : 'Add to cart'}
        </Button>
        <Link to="/app/cart" className="btn btn-ghost whitespace-nowrap">
          View cart
        </Link>
      </div>

      {product.description && (
        <div className="mt-6">
          <h2 className="text-base font-extrabold text-navy dark:text-biscuit mb-1">Details</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
            {product.description}
          </p>
        </div>
      )}

      <p className="mt-6 text-xs text-gray-500 dark:text-gray-400">
        {shopConfigured
          ? 'Shipping & taxes calculated at checkout.'
          : 'Demo product — connect a Shopify store to take real orders.'}
      </p>
      </div>
    </div>
  );
}
