import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';
import { getProducts, priceLabel, shopConfigured, type ShopProduct } from '../api/shop';
import Badge from '../components/ui/Badge';
import { CardSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { useDocumentTitle } from '../utils/useDocumentTitle';

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
      className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-soft-sm overflow-hidden flex flex-col"
    >
      <Link to={`/app/shop/${product.handle}`} className="block relative group">
        {img ? (
          <img
            src={img.url}
            alt={img.altText ?? product.title}
            loading="lazy"
            className="w-full aspect-square object-cover transition-transform duration-300 ease-soft-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full aspect-square bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-500/10 dark:to-brand-500/20 flex items-center justify-center">
            <span className="text-5xl opacity-40">🛍️</span>
          </div>
        )}
        {!product.available && (
          <span className="absolute top-2 left-2 inline-flex items-center px-2 py-0.5 text-2xs font-bold uppercase tracking-wide bg-gray-900/80 text-white rounded-full">
            Sold out
          </span>
        )}
      </Link>
      <div className="p-3 flex flex-col gap-1 flex-1">
        <Link
          to={`/app/shop/${product.handle}`}
          className="font-semibold text-gray-900 dark:text-gray-100 leading-tight hover:text-brand-600 transition-colors line-clamp-2"
        >
          {product.title}
        </Link>
        <p className="mt-auto pt-1 text-sm font-semibold text-brand-600 dark:text-brand-400">
          {priceLabel(product)}
        </p>
      </div>
    </motion.div>
  );
}

export default function ShopPage() {
  useDocumentTitle('Shop · Fetch');

  const {
    data: products = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['shop-products'], queryFn: getProducts });

  return (
    <div className="p-4 pb-8">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ShoppingBag size={20} aria-hidden className="text-brand-500" /> Shop
        </h1>
        {!shopConfigured && (
          <Badge
            variant="warning"
            className="uppercase tracking-wide"
            title="Sample catalog — connect a Shopify store to go live."
          >
            Demo
          </Badge>
        )}
      </div>
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-5">
        Branded gear for you and your pet. Every order ships carbon-neutral.
      </p>

      {isLoading && (
        <div className="grid grid-cols-2 gap-3">
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
        <div className="grid grid-cols-2 gap-3">
          {products.map((product, i) => (
            <ProductCard key={product.id} product={product} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
