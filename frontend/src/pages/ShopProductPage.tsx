import { useEffect, useMemo, useState } from 'react';
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
import Button from '../components/ui/Button';
import BackButton from '../components/ui/BackButton';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { Spinner } from '../components/ui/Skeleton';
import { useDocumentTitle } from '../utils/useDocumentTitle';

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

  // Seed the option selection once the product arrives.
  useEffect(() => {
    if (product) setSelected(defaultSelection(product));
  }, [product?.id]);

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
            <Link to="/app/shop" className="text-brand-500 text-sm hover:underline inline-block">
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
    <div className="p-4 pb-8">
      <BackButton fallback="/app/shop" label="Shop" />

      <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        {hero ? (
          <img
            src={hero.url}
            alt={hero.altText ?? product.title}
            className="w-full aspect-square object-cover"
          />
        ) : (
          <div className="w-full aspect-square bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-500/10 dark:to-brand-500/20 flex items-center justify-center">
            <span className="text-6xl opacity-40">🛍️</span>
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
                i === activeImage ? 'border-brand-500' : 'border-transparent opacity-70'
              }`}
            >
              <img src={img.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="mt-4">
        <h1 className="text-xl font-bold tracking-tight">{product.title}</h1>
        <p className="text-lg font-semibold text-brand-600 dark:text-brand-400 mt-1">
          {variant ? formatMoney(variant.price) : formatMoney(product.priceRange.min)}
        </p>
      </div>

      {showOptions &&
        product.options.map((option) => (
          <div key={option.name} className="mt-4">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
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
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      isSelected
                        ? 'bg-brand-500 text-white border-brand-500'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:border-brand-300'
                    } ${!valueAvailable ? 'opacity-40' : ''}`}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

      <div className="mt-5 flex items-center gap-3">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Qty</span>
        <div className="inline-flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="px-3 py-1.5 text-lg leading-none text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
            disabled={qty <= 1}
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="px-4 text-sm font-semibold tabular-nums">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => q + 1)}
            className="px-3 py-1.5 text-lg leading-none text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
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
        <Link
          to="/app/cart"
          className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline whitespace-nowrap"
        >
          View cart
        </Link>
      </div>

      {product.description && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Details</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">
            {product.description}
          </p>
        </div>
      )}

      <p className="mt-6 text-xs text-gray-400 dark:text-gray-500">
        {shopConfigured
          ? 'Shipping & taxes calculated at checkout.'
          : 'Demo product — connect a Shopify store to take real orders.'}
      </p>
    </div>
  );
}
