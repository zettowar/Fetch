import { Link } from 'react-router-dom';
import {
  formatMoney,
  shopConfigured,
  type ShopCartLine,
} from '../api/shop';
import { useCart } from '../utils/useCart';
import BrandIcon from '../components/brand/BrandIcon';
import Button from '../components/ui/Button';
import BackButton from '../components/ui/BackButton';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import PageHeader from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Skeleton';
import { useDocumentTitle } from '../utils/useDocumentTitle';

// Quantity stepper: a pill with a navy hairline, shared look with the product page.
const STEPPER =
  'inline-flex items-center rounded-full border-2 border-navy/25 bg-white overflow-hidden dark:border-white/20 dark:bg-night-surface';
const STEP_BTN =
  'px-2.5 py-1 text-base font-extrabold leading-none text-navy hover:bg-navy/5 disabled:opacity-40 dark:text-biscuit dark:hover:bg-white/10';

function CartRow({
  line,
  busy,
  onQty,
  onRemove,
}: {
  line: ShopCartLine;
  busy: boolean;
  onQty: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
}) {
  return (
    <div className="flex gap-3 py-3">
      <Link
        to={`/app/shop/${line.productHandle}`}
        className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-navy dark:border-white/15 bg-brand-50 dark:bg-night-raised"
      >
        {line.image ? (
          <img src={line.image.url} alt={line.image.altText ?? line.productTitle} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-navy/40 dark:text-biscuit/40">
            <BrandIcon name="bag" size={28} />
          </div>
        )}
      </Link>

      <div className="flex-1 min-w-0">
        <Link
          to={`/app/shop/${line.productHandle}`}
          className="font-extrabold text-sm text-navy dark:text-biscuit leading-tight hover:underline line-clamp-2"
        >
          {line.productTitle}
        </Link>
        {line.variantTitle && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{line.variantTitle}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5">
          <div className={STEPPER}>
            <button
              type="button"
              onClick={() => onQty(line.id, line.quantity - 1)}
              disabled={busy}
              className={STEP_BTN}
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="px-3 text-sm font-extrabold tabular-nums text-navy dark:text-biscuit">{line.quantity}</span>
            <button
              type="button"
              onClick={() => onQty(line.id, line.quantity + 1)}
              disabled={busy}
              className={STEP_BTN}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={() => onRemove(line.id)}
            disabled={busy}
            className="text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-danger-600 dark:hover:text-danger-300 transition-colors disabled:opacity-40"
          >
            Remove
          </button>
        </div>
      </div>

      <div className="flex-shrink-0 text-right">
        <p className="text-sm font-extrabold tabular-nums text-navy dark:text-biscuit">
          {formatMoney(line.lineTotal)}
        </p>
      </div>
    </div>
  );
}

export default function CartPage() {
  useDocumentTitle('Cart · Fetchpawz');
  const { cart, isLoading, isError, refetch, update, remove } = useCart();

  const busy = update.isPending || remove.isPending;
  const handleQty = (lineId: string, quantity: number) => update.mutate({ lineId, quantity });
  const handleRemove = (lineId: string) => remove.mutate(lineId);

  const checkout = () => {
    if (cart?.checkoutUrl) window.location.href = cart.checkoutUrl;
  };

  return (
    // Tablet: the phone stack as a centred column (cart rows stretched to
    // 900px put the price a long way from its product). Desktop: the lines
    // beside an order summary that stays in view while the list scrolls.
    <div className="p-4 pb-8 sm:mx-auto sm:w-full sm:max-w-2xl lg:max-w-none">
      <BackButton fallback="/app/shop" label="Shop" />
      <PageHeader title="Your cart" className="mb-4" />

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {!isLoading && isError && (
        <ErrorState message="Couldn't load your cart." onRetry={() => refetch()} />
      )}

      {!isLoading && !isError && (!cart || cart.lines.length === 0) && (
        <EmptyState
          illustration="sleeping"
          title="Your cart is empty"
          body="Browse the shop and add some gear for you and your pet."
          action={
            <Link to="/app/shop" className="btn btn-primary btn-sm">
              Go to shop
            </Link>
          }
        />
      )}

      {!isLoading && !isError && cart && cart.lines.length > 0 && (
        <div className="contents lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
          <div className="surface px-3 divide-y divide-gray-200 dark:divide-white/10">
            {cart.lines.map((line) => (
              <CartRow
                key={line.id}
                line={line}
                busy={busy}
                onQty={handleQty}
                onRemove={handleRemove}
              />
            ))}
          </div>

          {/* On lg the summary becomes its own panel (the .surface look). */}
          <div className="mt-4 pt-1 lg:mt-0 lg:sticky lg:top-20 lg:rounded-2xl lg:border lg:border-gray-200 lg:bg-white lg:p-4 dark:lg:border-white/10 dark:lg:bg-night-surface">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-gray-600 dark:text-gray-300">Subtotal</span>
              <span className="font-display text-2xl leading-none tabular-nums text-navy dark:text-biscuit">
                {formatMoney(cart.subtotal)}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Shipping & taxes calculated at checkout.
            </p>

            {shopConfigured ? (
              <Button size="lg" onClick={checkout} className="w-full" disabled={busy}>
                Checkout
              </Button>
            ) : (
              <>
                <Button size="lg" className="w-full" disabled>
                  Checkout
                </Button>
                <p className="mt-2 text-center text-xs text-gray-600 dark:text-gray-300">
                  Checkout goes live once a Shopify store is connected.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
