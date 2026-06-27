import { Link } from 'react-router-dom';
import {
  formatMoney,
  shopConfigured,
  type ShopCartLine,
} from '../api/shop';
import { useCart } from '../utils/useCart';
import Button from '../components/ui/Button';
import BackButton from '../components/ui/BackButton';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { Spinner } from '../components/ui/Skeleton';
import { useDocumentTitle } from '../utils/useDocumentTitle';

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
        to={`/shop/${line.productHandle}`}
        className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800"
      >
        {line.image ? (
          <img src={line.image.url} alt={line.image.altText ?? line.productTitle} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl opacity-40">🛍️</div>
        )}
      </Link>

      <div className="flex-1 min-w-0">
        <Link
          to={`/shop/${line.productHandle}`}
          className="font-semibold text-sm text-gray-900 dark:text-gray-100 leading-tight hover:text-brand-600 transition-colors line-clamp-2"
        >
          {line.productTitle}
        </Link>
        {line.variantTitle && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{line.variantTitle}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5">
          <div className="inline-flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              type="button"
              onClick={() => onQty(line.id, line.quantity - 1)}
              disabled={busy}
              className="px-2.5 py-1 text-base leading-none text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="px-3 text-sm font-semibold tabular-nums">{line.quantity}</span>
            <button
              type="button"
              onClick={() => onQty(line.id, line.quantity + 1)}
              disabled={busy}
              className="px-2.5 py-1 text-base leading-none text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={() => onRemove(line.id)}
            disabled={busy}
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors disabled:opacity-40"
          >
            Remove
          </button>
        </div>
      </div>

      <div className="flex-shrink-0 text-right">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {formatMoney(line.lineTotal)}
        </p>
      </div>
    </div>
  );
}

export default function CartPage() {
  useDocumentTitle('Cart · Fetch');
  const { cart, isLoading, isError, refetch, update, remove } = useCart();

  const busy = update.isPending || remove.isPending;
  const handleQty = (lineId: string, quantity: number) => update.mutate({ lineId, quantity });
  const handleRemove = (lineId: string) => remove.mutate(lineId);

  const checkout = () => {
    if (cart?.checkoutUrl) window.location.href = cart.checkoutUrl;
  };

  return (
    <div className="p-4 pb-8">
      <BackButton fallback="/shop" label="Shop" />
      <h1 className="text-xl font-bold tracking-tight mb-4 flex items-center gap-2">
        <span aria-hidden>🛒</span> Your cart
      </h1>

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
          icon="🛒"
          title="Your cart is empty"
          body="Browse the shop and add some gear for you and your pup."
          action={
            <Link to="/shop">
              <Button size="sm">Go to shop</Button>
            </Link>
          }
        />
      )}

      {!isLoading && !isError && cart && cart.lines.length > 0 && (
        <>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
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

          <div className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-500 dark:text-gray-400">Subtotal</span>
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {formatMoney(cart.subtotal)}
              </span>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
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
                <p className="mt-2 text-center text-xs text-amber-600 dark:text-amber-400">
                  Checkout goes live once a Shopify store is connected.
                </p>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
