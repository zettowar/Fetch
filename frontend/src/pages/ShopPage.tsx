import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getProducts, priceLabel, shopConfigured, type ShopProduct } from '../api/shop';
import BrandIcon from '../components/brand/BrandIcon';
import Badge from '../components/ui/Badge';
import PageHeader from '../components/ui/PageHeader';
import { CardSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { useDocumentTitle } from '../utils/useDocumentTitle';

// Two across on a phone, a column more as the pane widens.
const GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4';

function ProductCard({ product, index }: { product: ShopProduct; index: number }) {
  const img = product.featuredImage;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.32,
        ease: [0.22, 1, 0.36, 1],
        delay: Math.min(index * 0.03, 0.25),
      }}
      className="bg-white dark:bg-night-surface rounded-2xl border-2 border-navy dark:border-white/15 shadow-toy-sm overflow-hidden flex flex-col"
    >
      <Link
        to={`/app/shop/${product.handle}`}
        className="block relative group border-b-2 border-navy dark:border-white/15"
      >
        {img ? (
          <img
            src={img.url}
            alt={img.altText ?? product.title}
            loading="lazy"
            className="w-full aspect-square object-cover transition-transform duration-300 ease-soft-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full aspect-square bg-brand-50 dark:bg-night-raised flex items-center justify-center text-navy/40 dark:text-biscuit/40">
            <BrandIcon name="bag" size={56} />
          </div>
        )}
        {!product.available && (
          <Badge variant="neutral" className="absolute top-2 left-2">
            Sold out
          </Badge>
        )}
      </Link>
      <div className="p-3 flex flex-col gap-1 flex-1">
        <Link
          to={`/app/shop/${product.handle}`}
          className="text-base font-extrabold text-navy dark:text-biscuit leading-tight hover:underline line-clamp-2"
        >
          {product.title}
        </Link>
        <p className="mt-auto pt-1 text-sm font-extrabold tabular-nums text-gray-700 dark:text-gray-200">
          {priceLabel(product)}
        </p>
      </div>
    </motion.div>
  );
}

export default function ShopPage() {
  useDocumentTitle('Shop · Fetchpawz');

  const {
    data: products = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['shop-products'], queryFn: getProducts });

  return (
    <div className="p-4 pb-8">
      <PageHeader
        title="Shop"
        subtitle="Branded gear for you and your pet. Every order ships carbon-neutral."
        className="mb-5"
        action={
          !shopConfigured && (
            <Badge
              variant="info"
              title="Sample catalog — connect a Shopify store to go live."
            >
              Demo
            </Badge>
          )
        }
      />

      {isLoading && (
        <div className={GRID}>
          {[...Array(4)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {!isLoading && isError && (
        <ErrorState message="Couldn't load the shop." onRetry={() => refetch()} />
      )}

      {!isLoading && !isError && products.length === 0 && (
        <EmptyState
          illustration="sniffing"
          title="No products yet"
          body="Check back soon — new gear is on the way."
        />
      )}

      {!isLoading && !isError && products.length > 0 && (
        <div className={GRID}>
          {products.map((product, i) => (
            <ProductCard key={product.id} product={product} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
