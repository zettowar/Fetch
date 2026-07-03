import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  addToCart,
  getCart,
  removeCartLine,
  updateCartLine,
  type ShopCart,
} from '../api/shop';

const CART_KEY = ['shop-cart'] as const;

/**
 * Single source of truth for the shopping cart, shared by the product page
 * (add), the cart page (update/remove), and the nav badge (count). Every
 * mutation writes the fresh cart straight into the query cache so all three
 * update together without a refetch round-trip.
 *
 * Pass `enabled: false` where the cart isn't needed yet (e.g. the nav for
 * signed-out or rescue accounts) to avoid touching storage.
 */
export function useCart(enabled = true) {
  const qc = useQueryClient();
  const setCart = (cart: ShopCart) => qc.setQueryData(CART_KEY, cart);

  const query = useQuery({
    queryKey: CART_KEY,
    queryFn: getCart,
    enabled,
    staleTime: 30_000,
  });

  const add = useMutation({
    mutationFn: ({ variantId, quantity }: { variantId: string; quantity: number }) =>
      addToCart(variantId, quantity),
    onSuccess: setCart,
    onError: () => toast.error("Couldn't add that to your cart. Please try again."),
  });

  const update = useMutation({
    mutationFn: ({ lineId, quantity }: { lineId: string; quantity: number }) =>
      updateCartLine(lineId, quantity),
    onSuccess: setCart,
    onError: () => toast.error("Couldn't update your cart. Please try again."),
  });

  const remove = useMutation({
    mutationFn: (lineId: string) => removeCartLine(lineId),
    onSuccess: setCart,
    onError: () => toast.error("Couldn't remove that item. Please try again."),
  });

  return {
    cart: query.data,
    count: query.data?.totalQuantity ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    add,
    update,
    remove,
  };
}
